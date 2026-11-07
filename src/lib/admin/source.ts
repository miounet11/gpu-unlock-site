// Where the log records come from, kept separate from what is computed from them.
//
// The reports need to run in three places: a test (records handed in directly), the dev
// machine (a local directory of logs), and the production host (the same directory, possibly
// reached over ssh). Only this file knows the difference; the services below take a LogSource
// and therefore behave identically in all three.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";

import { parseLine, type LogRecord } from "./logs.ts";

export interface LogSource {
  /** Human-readable name for the report, e.g. the site or the directory. */
  readonly name: string;
  /** Records whose timestamp falls in [from, to]. Either bound may be null for "no limit". */
  readWindow(from: Date | null, to: Date | null): Promise<LogRecord[]>;
  /** Non-fatal problems: a file that would not open, a rotation gap. Shown in the report. */
  warnings(): string[];
}

/** A LogSource over a fixed set of records. Used by tests and by anything already parsed. */
export class MemoryLogSource implements LogSource {
  readonly name: string;
  private readonly records: LogRecord[];
  private readonly issues: string[];

  constructor(name: string, records: LogRecord[], warnings: string[] = []) {
    this.name = name;
    this.records = records;
    this.issues = [...warnings];
  }

  async readWindow(from: Date | null, to: Date | null): Promise<LogRecord[]> {
    const lo = from ? from.getTime() : -Infinity;
    const hi = to ? to.getTime() : Infinity;
    return this.records.filter((r) => {
      const t = Date.parse(r.at);
      return !Number.isNaN(t) && t >= lo && t <= hi;
    });
  }

  warnings(): string[] {
    return [...this.issues];
  }
}

interface FileSourceOptions {
  /** Directory holding nginx access logs. */
  dir: string;
  /** Base name without rotation suffix, e.g. `gpu-unlock-access.log`. */
  file: string;
  /** When set, the directories are read on this host over ssh instead of locally. */
  sshHost?: string;
}

/** Rotated siblings: `name`, `name.1`, `name.2.gz`, … newest first. */
function rotatedFiles(dir: string, file: string, list: (p: string) => string[]): string[] {
  const prefix = `${file}.`;
  const found = list(dir)
    .filter((entry) => entry === file || entry.startsWith(prefix))
    .filter((entry) => /^(?:\.\d+(?:\.gz)?)?$/.test(entry.slice(file.length)))
    .sort((a, b) => {
      const rank = (n: string) => (n === file ? 0 : Number(n.slice(file.length + 1).replace(".gz", "")) + 1);
      return rank(a) - rank(b);
    });
  return found.map((entry) => join(dir, entry));
}

export class FileLogSource implements LogSource {
  readonly name: string;
  private readonly opts: FileSourceOptions;
  private readonly issues: string[] = [];

  constructor(opts: FileSourceOptions) {
    this.opts = opts;
    this.name = opts.sshHost ? `${opts.sshHost}:${opts.dir}/${opts.file}` : join(opts.dir, opts.file);
  }

  private listDir(dir: string): string[] {
    if (this.opts.sshHost) {
      const out = execFileSync(
        "ssh",
        ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", this.opts.sshHost, `ls -1 ${quote(dir)}`],
        { encoding: "utf8", maxBuffer: 1 << 26 },
      );
      return out.split("\n").map((s) => s.trim()).filter(Boolean);
    }
    return readdirSync(dir);
  }

  /** Last-modified times in epoch ms, so the window can skip whole rotated files. */
  private fileTimes(dir: string, file: string): Map<string, number> {
    if (this.opts.sshHost) {
      const out = execFileSync(
        "ssh",
        [
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=10",
          this.opts.sshHost,
          `cd ${quote(dir)} && ls -ln --time-style=+%s ${quote(file)}* 2>/dev/null | awk '{print $6, $7}'`,
        ],
        { encoding: "utf8", maxBuffer: 1 << 26 },
      );
      const times = new Map<string, number>();
      for (const line of out.split("\n")) {
        const [secs, name] = line.trim().split(/\s+/);
        if (!secs || !name) continue;
        times.set(join(dir, name), Number(secs) * 1000);
      }
      return times;
    }
    const times = new Map<string, number>();
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      try {
        times.set(path, statSync(path).mtimeMs);
      } catch {
        // Unreadable entries are handled where they are read.
      }
    }
    return times;
  }

  // Rotated nginx logs end in .gz once they pass the daily rotation, and the uncompressed
  // branch used to read them as text: every compressed sibling silently produced one garbage
  // line that then failed to parse, so reports under-counted history while looking complete.
  private readLocalFile(path: string): string {
    if (path.endsWith(".gz")) {
      return gunzipSync(readFileSync(path)).toString("utf8");
    }
    return readFileSync(path, "utf8");
  }

  /**
   * Reads every file in one ssh invocation and transfers it compressed.
   *
   * Two separate costs showed up measuring the production host: one ssh per file (fourteen
   * handshakes) and the link itself, which moved ~16KB/s — so shipping decompressed log text
   * was the larger problem, and a 7-day report was shipping every byte of a fortnight. Now the
   * far side compresses each file before it leaves, and the whole batch is one connection.
   *
   * Each section is framed as `GU <index> <status> <bytes>\n` followed by exactly that many
   * bytes of gzip data. A length header rather than a delimiter is deliberate: gzip output is
   * arbitrary bytes, so no marker string can be assumed absent from it.
   */
  private readRemoteFiles(files: string[]): Map<string, { text: string; ok: boolean }> {
    const steps = files.map((file, i) => {
      const q = quote(file);
      // A rotated .gz sibling is already a gzip member; a plain file is compressed on the way
      // out. Either way the local side calls gunzip and gets the same result.
      const body = file.endsWith(".gz") ? `cat ${q} > "$t"` : `gzip -c ${q} > "$t" 2>/dev/null`;
      // `wc -c` pads its output; the header is parsed strictly, so the padding has to go.
      return `t=$(mktemp); ${body}; st=$?; printf 'GU ${i} %s %s\\n' "$st" "$(wc -c < "$t" | tr -d ' ')"; cat "$t"; rm -f "$t"`;
    });
    const out = execFileSync(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", this.opts.sshHost!, steps.join("; ")],
      { maxBuffer: 1 << 30 },
    );

    const collected = new Map<string, { text: string; ok: boolean }>();
    let at = 0;
    while (at < out.length) {
      const nl = out.indexOf(0x0a, at);
      if (nl < 0) break;
      const header = /^GU (\d+) (\d+) (\d+)$/.exec(out.subarray(at, nl).toString("latin1"));
      at = nl + 1;
      if (!header) {
        this.issues.push("unexpected output from remote log read");
        break;
      }
      const index = Number(header[1]);
      const status = Number(header[2]);
      const size = Number(header[3]);
      const section = out.subarray(at, at + size);
      at += size;
      const file = files[index];
      if (file === undefined) continue;
      if (status !== 0) {
        collected.set(file, { text: "", ok: false });
        continue;
      }
      try {
        collected.set(file, { text: gunzipSync(section).toString("utf8"), ok: true });
      } catch (err) {
        collected.set(file, { text: "", ok: false });
        this.issues.push(`cannot decompress ${file}: ${(err as Error).message}`);
      }
    }
    return collected;
  }

  async readWindow(from: Date | null, to: Date | null): Promise<LogRecord[]> {
    let files: string[];
    try {
      files = rotatedFiles(this.opts.dir, this.opts.file, (d) => this.listDir(d));
    } catch (err) {
      this.issues.push(`cannot list ${this.opts.dir}: ${(err as Error).message}`);
      return [];
    }

    const lo = from ? from.getTime() : -Infinity;
    const hi = to ? to.getTime() : Infinity;

    // Skip whole files that cannot overlap the window: rotated files are ordered newest first,
    // so the first one older than `from` ends the search. This matters most over ssh, where
    // skipping is the only thing standing between a 7-day report and shipping every byte of a
    // fortnight of logs across a link that measured ~16KB/s.
    if (files.length > 0 && lo !== -Infinity) {
      let times: Map<string, number>;
      try {
        times = this.fileTimes(this.opts.dir, this.opts.file);
      } catch {
        times = new Map();
      }
      const kept: string[] = [];
      for (const file of files) {
        const mtime = times.get(file);
        if (mtime !== undefined && mtime < lo - 86_400_000) break;
        kept.push(file);
      }
      files = kept;
    }

    const out: LogRecord[] = [];
    const parseInto = (text: string) => {
      for (const line of text.split("\n")) {
        const rec = parseLine(line);
        if (!rec) continue;
        const t = Date.parse(rec.at);
        if (t >= lo && t <= hi) out.push(rec);
      }
    };

    if (this.opts.sshHost) {
      if (files.length === 0) return out;
      let batch: Map<string, { text: string; ok: boolean }>;
      try {
        batch = this.readRemoteFiles(files);
      } catch (err) {
        this.issues.push(`cannot read ${files.length} file(s) from ${this.opts.sshHost}: ${(err as Error).message}`);
        return out;
      }
      for (const file of files) {
        const got = batch.get(file);
        if (!got) {
          this.issues.push(`ssh returned no output for ${file}`);
          continue;
        }
        if (!got.ok) {
          this.issues.push(`cannot read ${file}: remote read failed`);
          continue;
        }
        parseInto(got.text);
      }
      return out;
    }

    for (const file of files) {
      let text: string;
      try {
        text = this.readLocalFile(file);
      } catch (err) {
        this.issues.push(`cannot read ${file}: ${(err as Error).message}`);
        continue;
      }
      parseInto(text);
    }

    return out;
  }

  warnings(): string[] {
    return [...this.issues];
  }
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

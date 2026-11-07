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

  private readFile(path: string): string {
    if (this.opts.sshHost) {
      // `gzip -dc` handles both plain and compressed files; nginx's JSON log is line-based,
      // so this needs no parsing on the far side.
      return execFileSync(
        "ssh",
        ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", this.opts.sshHost, `gzip -dc ${quote(path)}`],
        { encoding: "utf8", maxBuffer: 1 << 30 },
      );
    }
    // Rotated nginx logs end in .gz once they pass the daily rotation, and this branch used to
    // read them as text: every compressed sibling silently produced one garbage line that then
    // failed to parse, so local reports under-counted history while looking complete.
    if (path.endsWith(".gz")) {
      return gunzipSync(readFileSync(path)).toString("utf8");
    }
    return readFileSync(path, "utf8");
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
    const out: LogRecord[] = [];

    for (const file of files) {
      // Skip whole files that cannot overlap the window: rotated files are ordered newest
      // first, so the first one older than `from` ends the search.
      if (!this.opts.sshHost) {
        try {
          const mtime = statSync(file).mtimeMs;
          if (mtime < lo - 86_400_000) break;
        } catch {
          // Fall through and try to read it anyway.
        }
      }
      let text: string;
      try {
        text = this.readFile(file);
      } catch (err) {
        this.issues.push(`cannot read ${file}: ${(err as Error).message}`);
        continue;
      }
      for (const line of text.split("\n")) {
        const rec = parseLine(line);
        if (!rec) continue;
        const t = Date.parse(rec.at);
        if (t >= lo && t <= hi) out.push(rec);
      }
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

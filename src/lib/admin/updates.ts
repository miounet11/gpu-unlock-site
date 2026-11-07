// Updates report: what is committed, what is built, and whether the site was checked since.
//
// Every field here can be genuinely unavailable — the API may run on a host with no checkout,
// no git, or no access to the deployed tree. Those cases return null and a warning rather than
// a zero, because "0 files uncommitted" and "could not look" are opposite conclusions.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import type { UpdatesReport } from "./types.ts";

export interface UpdatesOptions {
  /** Repository root to inspect. Defaults to the working directory. */
  repoDir?: string;
  /** Absolute path to the deployed BUILD_ID, when the API runs beside the deployed tree. */
  buildIdPath?: string;
  /** Absolute path to the patrol log written by deploy/patrol-live.sh. */
  patrolLogPath?: string;
}

function git(repoDir: string, args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: repoDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Parse the patrol log into its last status and the current run of consecutive ok runs.
 * Lines look like:
 *   2026-11-07T03:50:01+00:00 patrol rc=0 patrol ok  14 page(s) looked right
 *   2026-11-07T03:50:01+00:00 patrol rc=1 patrol failed  14 problem(s) across 14 page(s)
 */
export function parsePatrolLog(text: string): {
  lastRun: string | null;
  lastStatus: "ok" | "failed" | null;
  consecutiveOk: number;
} {
  let lastRun: string | null = null;
  let lastStatus: "ok" | "failed" | null = null;
  let consecutiveOk = 0;
  let stillCounting = true;

  const lines = text.split("\n").filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^(\S+)\s+patrol\s+rc=(\d+)\s+patrol\s+(ok|failed)/);
    if (!m) continue;
    const status = m[3] as "ok" | "failed";
    if (lastRun === null) {
      lastRun = m[1];
      lastStatus = status;
    }
    if (status === "ok" && stillCounting) consecutiveOk++;
    else stillCounting = false;
  }
  return { lastRun, lastStatus, consecutiveOk };
}

export async function buildUpdatesReport(opts: UpdatesOptions = {}): Promise<UpdatesReport> {
  const repoDir = opts.repoDir ?? process.cwd();
  const warnings: string[] = [];

  let branch: string | null = null;
  let head: string | null = null;
  let headDate: string | null = null;
  let headSubject: string | null = null;
  let aheadOfOrigin: number | null = null;
  let originHead: string | null = null;
  let uncommittedFiles: number | null = null;

  const toplevel = git(repoDir, ["rev-parse", "--show-toplevel"]);
  const sourceAvailable = toplevel !== null;
  if (!sourceAvailable) {
    warnings.push(`no git checkout at ${repoDir}; commit fields are null rather than zero`);
  } else {
    branch = git(repoDir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    head = git(repoDir, ["rev-parse", "--short", "HEAD"]);
    const logLine = git(repoDir, ["log", "-1", "--format=%cI%x00%s"]);
    if (logLine) {
      const [date, subject] = logLine.split("\0");
      headDate = date ?? null;
      headSubject = subject ?? null;
    }
    const counts = git(repoDir, ["rev-list", "--left-right", "--count", "origin/HEAD...HEAD"]);
    if (counts) {
      const [, ahead] = counts.split(/\s+/);
      aheadOfOrigin = Number.parseInt(ahead ?? "", 10);
      if (Number.isNaN(aheadOfOrigin)) aheadOfOrigin = null;
    }
    originHead = git(repoDir, ["rev-parse", "--short", "origin/HEAD"]);
    const status = git(repoDir, ["status", "--porcelain"]);
    if (status !== null) uncommittedFiles = status ? status.split("\n").length : 0;
  }

  let buildId: string | null = null;
  let builtAt: string | null = null;
  if (opts.buildIdPath) {
    if (existsSync(opts.buildIdPath)) {
      try {
        buildId = readFileSync(opts.buildIdPath, "utf8").trim() || null;
      } catch (err) {
        warnings.push(`cannot read ${opts.buildIdPath}: ${(err as Error).message}`);
      }
    } else {
      warnings.push(`no deployed build at ${opts.buildIdPath}; deploy fields are null`);
    }
  } else {
    warnings.push("no deployed-build path configured; deploy fields are null");
  }

  // BUILD_ID is a content hash of the build, not of the commit, so it cannot be compared to a
  // commit sha. Report it as unknown instead of guessing "matches" from timestamps.
  const matchesHead: boolean | null = null;
  if (buildId) {
    warnings.push(
      "build/commit correspondence is unknown: BUILD_ID hashes the build output, not the commit",
    );
  }

  let patrol = { lastRun: null, lastStatus: null, consecutiveOk: null } as UpdatesReport["patrol"];
  if (opts.patrolLogPath) {
    if (existsSync(opts.patrolLogPath)) {
      try {
        const parsed = parsePatrolLog(readFileSync(opts.patrolLogPath, "utf8"));
        patrol = {
          lastRun: parsed.lastRun,
          lastStatus: parsed.lastStatus,
          consecutiveOk: parsed.consecutiveOk,
        };
      } catch (err) {
        warnings.push(`cannot read patrol log: ${(err as Error).message}`);
      }
    } else {
      warnings.push(`no patrol log at ${opts.patrolLogPath}; patrol fields are null`);
    }
  } else {
    warnings.push("no patrol-log path configured; patrol fields are null");
  }

  return {
    generatedAt: new Date().toISOString(),
    window: { from: null, to: null, daysCovered: 0 },
    warnings,
    sourceAvailable,
    repo: { branch, head, headDate, headSubject, aheadOfOrigin, originHead, uncommittedFiles },
    deployed: { buildId, builtAt, matchesHead },
    patrol,
  };
}

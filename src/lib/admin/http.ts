// Shared request handling for the four admin routes.
//
// Two rules apply to all of them. The window is validated here rather than in each service, so
// an unparseable date is one 400 with one message instead of four different behaviours. And an
// unreadable data source is a 503 with the reason, not an empty 200 — a report that silently
// reports zero requests when the log directory moved is worse than one that refuses.

import { FileLogSource, MemoryLogSource, type LogSource } from "./source.ts";

export interface ParsedWindow {
  from: Date | null;
  to: Date | null;
}

export interface WindowResult {
  ok: boolean;
  window?: ParsedWindow;
  error?: string;
}

const DAY_MS = 86_400_000;

/**
 * Read `from`/`to`/`days` from the query string.
 *
 * `days` is the convenient form and is what a dashboard sends. `from`/`to` are ISO dates. A
 * bad value is an error, not a fallback: silently defaulting to the last 7 days would answer a
 * different question than the caller asked.
 */
export function parseWindow(params: URLSearchParams, now = new Date()): WindowResult {
  const daysRaw = params.get("days");
  const fromRaw = params.get("from");
  const toRaw = params.get("to");

  if (daysRaw !== null) {
    if (fromRaw !== null || toRaw !== null) {
      return { ok: false, error: "use either days or from/to, not both" };
    }
    if (!/^\d+$/.test(daysRaw)) {
      return { ok: false, error: `days must be a positive integer, got ${JSON.stringify(daysRaw)}` };
    }
    const days = Number(daysRaw);
    if (days < 1 || days > 90) {
      return { ok: false, error: "days must be between 1 and 90" };
    }
    const to = new Date(now);
    const from = new Date(now.getTime() - (days - 1) * DAY_MS);
    from.setUTCHours(0, 0, 0, 0);
    return { ok: true, window: { from, to } };
  }

  const parse = (raw: string, label: string): Date | string => {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return `${label} is not a date: ${JSON.stringify(raw)}`;
    return d;
  };

  let from: Date | null = null;
  let to: Date | null = null;

  if (fromRaw !== null) {
    const r = parse(fromRaw, "from");
    if (typeof r === "string") return { ok: false, error: r };
    from = r;
  }
  if (toRaw !== null) {
    const r = parse(toRaw, "to");
    if (typeof r === "string") return { ok: false, error: r };
    to = r;
  }
  if (from && to && from > to) {
    return { ok: false, error: "from is after to" };
  }
  if (!from && !to) {
    const to2 = new Date(now);
    const from2 = new Date(now.getTime() - 6 * DAY_MS);
    from2.setUTCHours(0, 0, 0, 0);
    return { ok: true, window: { from: from2, to: to2 } };
  }

  return { ok: true, window: { from, to } };
}

export interface SourceConfig {
  /** Directory holding the nginx logs, e.g. /var/log/nginx. */
  logDir: string;
  /** Base file name, e.g. "gpu-unlock-access.log". Rotated siblings are included. */
  logFile: string;
  /** When set, the directory is read over ssh instead of locally. */
  sshHost?: string;
}

/**
 * Build the log source for a route. Configuration comes from the environment because the API
 * runs on the same host as nginx in production, but on a laptop with no logs at all. A missing
 * directory is reported by the source as a warning, and no records come back, which the routes
 * turn into a 503 rather than an empty report.
 */
export function sourceFromEnv(name: string): LogSource {
  const logDir = process.env.GPU_UNLOCK_LOG_DIR;
  const logFile = process.env.GPU_UNLOCK_LOG_FILE;
  if (!logDir || !logFile) {
    return new MemoryLogSource(name, [], [
      "GPU_UNLOCK_LOG_DIR and GPU_UNLOCK_LOG_FILE are not set; no traffic data was read",
    ]);
  }
  return new FileLogSource({
    dir: logDir,
    file: logFile,
    sshHost: process.env.GPU_UNLOCK_LOG_SSH || undefined,
  });
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // These reports are read-only snapshots; caching them would hide a broken patrol.
      "cache-control": "no-store",
    },
  });
}

export function badRequest(error: string): Response {
  return json({ error }, 400);
}

export function unavailable(error: string, warnings: string[] = []): Response {
  return json({ error, warnings }, 503);
}

// Crawler report: who crawled, how much, and how much of the sitemap they actually reached.
//
// The coverage number is the only index-shaped signal available from logs, and it is a crawl
// count, not an index count. A URL being fetched 400 times says nothing about whether it is
// indexed, so it is labelled `inferred` everywhere it appears.

import { classifyTraffic, normalizePath, type LogRecord } from "./logs.ts";
import type { LogSource } from "./source.ts";
import type { CrawlerRanking, CrawlerReport, Metric } from "./types.ts";

export interface CrawlerOptions {
  site: string;
  /** Absolute sitemap URL, or null to skip coverage entirely. */
  sitemapUrl: string | null;
  /** Injectable for tests; defaults to global fetch. */
  fetchText?: (url: string) => Promise<string>;
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 100;
}

/** Paths listed in a sitemap document. Only <loc> entries; sitemap indexes are not followed. */
export function sitemapPaths(xml: string): string[] {
  const paths: string[] = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    try {
      paths.push(normalizePath(new URL(m[1]).pathname));
    } catch {
      // A malformed <loc> is not worth failing the report over; the count will show it.
    }
  }
  return paths;
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function buildCrawlerReport(
  source: LogSource,
  window: { from: Date | null; to: Date | null },
  opts: CrawlerOptions,
): Promise<CrawlerReport> {
  const records: LogRecord[] = await source.readWindow(window.from, window.to);
  const warnings = [...source.warnings()];

  const perBot = new Map<string, { requests: number; lastSeen: string | null }>();
  let botRequests = 0;
  let human = 0;
  /** per crawler name -> set of normalized paths */
  const reached = new Map<string, Set<string>>();
  let anyBotPaths = new Set<string>();

  for (const rec of records) {
    const kind = classifyTraffic(rec);
    if (kind.kind !== "bot") {
      if (kind.kind === "human") human++;
      continue;
    }
    botRequests++;
    const entry = perBot.get(kind.label) ?? { requests: 0, lastSeen: null };
    entry.requests++;
    if (!entry.lastSeen || rec.at > entry.lastSeen) entry.lastSeen = rec.at;
    perBot.set(kind.label, entry);

    const path = normalizePath(rec.uri);
    if (!reached.has(kind.label)) reached.set(kind.label, new Set());
    reached.get(kind.label)!.add(path);
    anyBotPaths.add(path);
  }

  const total = records.length;
  const ranking: CrawlerRanking[] = [...perBot.entries()]
    .map(([crawler, v]) => ({ crawler, requests: v.requests, share: pct(v.requests, total), lastSeen: v.lastSeen }))
    .sort((a, b) => b.requests - a.requests);

  const totalMetric: Metric = {
    value: total,
    confidence: "measured",
    basis: "access-log lines inside the requested window",
  };
  const botMetric: Metric = {
    value: botRequests,
    confidence: "measured",
    basis: "lines whose User-Agent matched a known crawler token",
  };
  const humanMetric: Metric = {
    value: human,
    confidence: "inferred",
    basis: "lines with no crawler token, after removing own-script and disguised-crawler traffic and scanner paths",
  };

  let coverage: CrawlerReport["sitemapCoverage"] = null;
  if (opts.sitemapUrl) {
    try {
      const xml = await (opts.fetchText ?? defaultFetchText)(opts.sitemapUrl);
      const urls = sitemapPaths(xml);
      const google = reached.get("Googlebot") ?? new Set<string>();
      const bing = reached.get("Bingbot") ?? new Set<string>();
      coverage = {
        urls: urls.length,
        crawledByGoogle: {
          value: urls.filter((u) => google.has(u)).length,
          confidence: "inferred",
          basis: "sitemap paths seen in at least one Googlebot request — a crawl, not an index entry",
        },
        crawledByBing: {
          value: urls.filter((u) => bing.has(u)).length,
          confidence: "inferred",
          basis: "sitemap paths seen in at least one Bingbot request — a crawl, not an index entry",
        },
        crawledByAnyBot: {
          value: urls.filter((u) => anyBotPaths.has(u)).length,
          confidence: "inferred",
          basis: "sitemap paths fetched by any recognised crawler in this window",
        },
        neverCrawled: urls.filter((u) => !anyBotPaths.has(u)).slice(0, 50),
      };
    } catch (err) {
      warnings.push(`sitemap unavailable (${opts.sitemapUrl}): ${(err as Error).message}`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    window: {
      from: window.from?.toISOString() ?? null,
      to: window.to?.toISOString() ?? null,
      daysCovered: countDays(records),
    },
    warnings,
    site: opts.site,
    totalRequests: totalMetric,
    botRequests: botMetric,
    botShare: {
      value: pct(botRequests, total),
      confidence: "measured",
      basis: "bot lines / all lines in the window",
    },
    humanRequests: humanMetric,
    ranking,
    sitemapCoverage: coverage,
  };
}

export function countDays(records: LogRecord[]): number {
  const days = new Set<string>();
  for (const r of records) days.add(r.at.slice(0, 10));
  return days.size;
}

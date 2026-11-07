// Indexing report: what the site declares, and what search engines came to fetch.
//
// There is deliberately no "indexed pages" number. Search engines do not expose one to this
// host — no Search Console, no Bing Webmaster credentials — so the field exists as a permanent
// null with a note, rather than being filled with a crawl count that would read like an index
// count in a dashboard. What can be measured is declared: sitemap reachability and URL count,
// robots reachability, and which engines sent visitors.

import { classifyTraffic, refererHost, searchEngineFor, type LogRecord } from "./logs.ts";
import type { LogSource } from "./source.ts";
import { sitemapPaths } from "./crawler.ts";
import { countDays } from "./crawler.ts";
import type { IndexingReport } from "./types.ts";

export interface IndexingOptions {
  site: string;
  sitemapUrl: string;
  robotsUrl: string;
  fetchText?: (url: string) => Promise<string>;
}

async function defaultFetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Count `Sitemap:` directives in a robots.txt. Directives are case-insensitive and may be
 * indented; blank lines and comments are not directives.
 */
export function countSitemapDirectives(robots: string): number {
  return robots
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .filter((line) => /^sitemap\s*:/i.test(line)).length;
}

export async function buildIndexingReport(
  source: LogSource,
  window: { from: Date | null; to: Date | null },
  opts: IndexingOptions,
): Promise<IndexingReport> {
  const fetchText = opts.fetchText ?? defaultFetchText;
  const warnings: string[] = [];

  // Both documents are fetched even if one fails: a robots failure should not hide a sitemap
  // count, and a reader needs to see which of the two is actually broken.
  let sitemapReachable = false;
  let urlCount: number | null = null;
  try {
    const xml = await fetchText(opts.sitemapUrl);
    sitemapReachable = true;
    urlCount = sitemapPaths(xml).length;
  } catch (err) {
    warnings.push(`sitemap unavailable (${opts.sitemapUrl}): ${(err as Error).message}`);
  }

  let robotsReachable = false;
  let sitemapDirectives = 0;
  try {
    const robots = await fetchText(opts.robotsUrl);
    robotsReachable = true;
    sitemapDirectives = countSitemapDirectives(robots);
  } catch (err) {
    warnings.push(`robots unavailable (${opts.robotsUrl}): ${(err as Error).message}`);
  }

  const records: LogRecord[] = await source.readWindow(window.from, window.to);
  warnings.push(...source.warnings());

  const engines = new Map<string, number>();
  for (const rec of records) {
    if (classifyTraffic(rec).kind !== "human") continue;
    const host = refererHost(rec.referer);
    if (!host) continue;
    const engine = searchEngineFor(host);
    if (engine) engines.set(engine, (engines.get(engine) ?? 0) + 1);
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
    sitemap: { url: opts.sitemapUrl, reachable: sitemapReachable, urlCount },
    robots: { url: opts.robotsUrl, reachable: robotsReachable, sitemapDirectives },
    // Ties break on name so the same window always lists the same order; a map's insertion
    // order depends on which log line happened to come first, which makes diffs noisy.
    searchReferrals: [...engines.entries()]
      .map(([engine, visits]) => ({ engine, visits }))
      .sort((a, b) => b.visits - a.visits || a.engine.localeCompare(b.engine)),
    indexedPages: null,
    indexedPagesNote:
      "Not available. Search engines do not publish an index count to this host, and no Search " +
      "Console or Bing Webmaster credentials are configured. A crawl count from the access log " +
      "is a different measurement and is reported by the crawler report as such.",
  };
}

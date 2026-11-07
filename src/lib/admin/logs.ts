// Reading nginx access logs, for both formats the host actually writes.
//
// gpu-unlock.com and gpuunlock.com use a JSON log_format; the sibling sites on the same host
// use the stock combined format. Anything that reads these logs has to handle both, or the
// reports quietly disagree with each other depending on which site is asked about.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export interface LogRecord {
  /** ISO-8601 UTC. */
  at: string;
  ip: string;
  method: string;
  uri: string;
  status: number;
  bytes: number;
  referer: string;
  ua: string;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** `07/Nov/2026:00:02:38 +0000` -> `2026-11-07T00:02:38.000Z` */
function combinedTime(raw: string): string | null {
  const m = raw.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  const offset = m[7] ?? "+0000";
  const iso = `${m[3]}-${month}-${m[1]}T${m[4]}:${m[5]}:${m[6]}${offset.slice(0, 3)}:${offset.slice(3)}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

const COMBINED =
  /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+)[^"]*" (\d{3}) (\d+|-) "(.*?)" "(.*?)"/;

export function parseLine(line: string): LogRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const o = JSON.parse(trimmed) as Record<string, unknown>;
      const at = typeof o.t === "string" ? new Date(o.t) : null;
      if (!at || Number.isNaN(at.getTime())) return null;
      // A line without a path cannot be attributed to a page. Defaulting it to "/" would count
      // a malformed entry as a homepage hit, which is a guess dressed up as a measurement.
      if (typeof o.uri !== "string" || o.uri === "") return null;
      return {
        at: at.toISOString(),
        ip: String(o.ip ?? ""),
        method: String(o.method ?? "GET"),
        uri: o.uri,
        status: Number(o.status ?? 0),
        bytes: Number(o.bytes ?? 0),
        referer: String(o.referer ?? ""),
        ua: String(o.ua ?? ""),
      };
    } catch {
      return null;
    }
  }

  const m = trimmed.match(COMBINED);
  if (!m) return null;
  const at = combinedTime(m[2]);
  if (!at) return null;
  return {
    at,
    ip: m[1],
    method: m[3],
    uri: m[4],
    status: Number(m[5]),
    bytes: m[6] === "-" ? 0 : Number(m[6]),
    referer: m[7],
    ua: m[8],
  };
}

/** Reads a log file, transparently decompressing rotated `.gz` siblings. */
export function readLogFile(path: string): string {
  if (path.endsWith(".gz")) {
    return execFileSync("gzip", ["-dc", path], { maxBuffer: 1 << 30, encoding: "utf8" });
  }
  return readFileSync(path, "utf8");
}

export function parseLog(text: string): LogRecord[] {
  const out: LogRecord[] = [];
  for (const line of text.split("\n")) {
    const rec = parseLine(line);
    if (rec) out.push(rec);
  }
  return out;
}

export interface BotMatch {
  name: string;
  /** Search engine and AI crawlers we care about getting coverage from. */
  search: boolean;
}

// Order matters: the first match wins, so a UA naming both Googlebot and Chrome is a crawler.
// Every pattern is anchored on a product token rather than a bare substring, because a UA like
// "Mozilla/5.0 ... Chrome/156" must never match, and "robotics" has nothing to do with bots.
const BOT_RULES: Array<{ name: string; re: RegExp; search: boolean }> = [
  { name: "Googlebot", re: /Googlebot\/|Googlebot-|Google-InspectionTool|GoogleOther|Mediapartners-Google/i, search: true },
  { name: "Bingbot", re: /bingbot\/|BingPreview\/|msnbot\/|adidxbot\//i, search: true },
  { name: "DuckDuckBot", re: /DuckDuckBot\/|DuckDuckGo-Favicons/i, search: true },
  { name: "Baiduspider", re: /Baiduspider/i, search: true },
  { name: "YandexBot", re: /YandexBot\/|YandexImages|YandexMetrika/i, search: true },
  { name: "Applebot", re: /Applebot\/|Applebot-Extended/i, search: true },
  { name: "PetalBot", re: /PetalBot/i, search: true },
  { name: "SeznamBot", re: /SeznamBot/i, search: true },
  { name: "Naver", re: /Yeti\/|NaverBot/i, search: true },
  { name: "GPTBot", re: /GPTBot\/|OAI-SearchBot\/|ChatGPT-User\//i, search: false },
  { name: "ClaudeBot", re: /ClaudeBot\/|Claude-User\/|Claude-SearchBot\//i, search: false },
  { name: "PerplexityBot", re: /PerplexityBot\/|Perplexity-User\//i, search: false },
  { name: "ExaBot", re: /ExaSearchBot\/|ExaBot\//i, search: false },
  { name: "Amazonbot", re: /Amazonbot\/|Amazonbot-Crawler/i, search: false },
  { name: "Bytespider", re: /Bytespider/i, search: false },
  { name: "CCBot", re: /CCBot\//i, search: false },
  { name: "AhrefsBot", re: /AhrefsBot\/|AhrefsSiteAudit\//i, search: false },
  { name: "SemrushBot", re: /SemrushBot\/|SemrushBot-SA/i, search: false },
  { name: "MJ12bot", re: /MJ12bot\//i, search: false },
  { name: "DotBot", re: /DotBot\//i, search: false },
  { name: "DataForSeoBot", re: /DataForSeoBot\//i, search: false },
  { name: "Meta", re: /facebookexternalhit\/|FacebookBot\/|meta-externalagent\//i, search: false },
  { name: "Twitterbot", re: /Twitterbot\/|LinkedInBot\/|Slackbot|TelegramBot/i, search: false },
  { name: "UptimeMonitor", re: /UptimeRobot|Pingdom|StatusCake|Better ?Uptime|Site24x7|Datadog\/|NewRelicPinger/i, search: false },
  { name: "GenericCrawler", re: /(?:bot|crawler|spider|slurp|archiver|scrapy)[\/\- )]|python-requests\/|go-http-client\/|okhttp\/|axios\/|node-fetch\//i, search: false },
];

export function classifyBot(ua: string): BotMatch | null {
  if (!ua) return null;
  for (const rule of BOT_RULES) {
    if (rule.re.test(ua)) return { name: rule.name, search: rule.search };
  }
  return null;
}

// Crawlers that present a stock browser UA, plus this host's own scripts, which identify as
// `node` and would otherwise be counted as readers. Detected by address or by the bare product
// token, because a UA-only filter that looks for "bot" sees neither.
const DISGUISED_CRAWLER_NETS: Array<{ name: string; re: RegExp }> = [
  { name: "Google crawler (66.249.66.0/24)", re: /^66\.249\.66\./ },
];

/** This host's own tooling: verify-deployment, patrol-live, and curl probes from 127.0.0.1. */
const OWN_SCRIPT_UA = /^node(?:[/\s]|$)/;

// Rapid-fire scanners that also present a browser UA. These are not crawlers in any useful
// sense — they request /.git/config and /wp-admin/install.php and nothing else — so they are
// excluded from user counts rather than promoted into the crawler ranking.
const SCANNER_NETS: Array<{ name: string; re: RegExp }> = [
  { name: "scanner (2a06:98c0::/32)", re: /^2a06:98c0/i },
  { name: "scanner (45.138.12.0/24)", re: /^45\.138\.12\./ },
];

const SCANNER_URI =
  /wp-admin|wp-includes|wp-login|xmlrpc\.php|wlwmanifest\.xml|\/\.env|\/\.git|\/\.ssh|\/\.aws|phpmyadmin|\.php$|\/ads\.txt|\/\.well-known\/traffic-advice|install\.php/i;

export type TrafficClass = "human" | "bot" | "disguised" | "scanner";

export interface Classification {
  kind: TrafficClass;
  /** For kind=bot, the crawler name; for the others, why it was excluded. */
  label: string;
  /** True only for kind=bot and a search-engine crawler. */
  searchEngine: boolean;
}

export function classifyTraffic(rec: LogRecord): Classification {
  const bot = classifyBot(rec.ua);
  if (bot) return { kind: "bot", label: bot.name, searchEngine: bot.search };

  if (OWN_SCRIPT_UA.test(rec.ua)) {
    return { kind: "disguised", label: "own script (node)", searchEngine: false };
  }
  for (const net of DISGUISED_CRAWLER_NETS) {
    if (net.re.test(rec.ip)) return { kind: "disguised", label: net.name, searchEngine: false };
  }
  for (const net of SCANNER_NETS) {
    if (net.re.test(rec.ip)) return { kind: "scanner", label: net.name, searchEngine: false };
  }
  if (SCANNER_URI.test(rec.uri)) {
    return { kind: "scanner", label: "scanner path", searchEngine: false };
  }
  return { kind: "human", label: "human", searchEngine: false };
}

/** Host of a referer, `www.` stripped. Returns null when absent or unparseable. */
export function refererHost(referer: string): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export const SEARCH_ENGINES: Array<{ name: string; re: RegExp }> = [
  { name: "Google", re: /^(?:[\w-]+\.)*google\.(?:com|com\.hk|co\.\w{2,3}|de|fr|es|co\.jp|ca|com\.au|co\.uk|com\.br|it|nl)$/ },
  { name: "Bing", re: /^(?:[\w-]+\.)*bing\.com$/ },
  { name: "DuckDuckGo", re: /^(?:[\w-]+\.)*duckduckgo\.com$/ },
  { name: "Baidu", re: /^(?:[\w-]+\.)*baidu\.com$/ },
  { name: "Yandex", re: /^(?:[\w-]+\.)*yandex\.(?:ru|com|com\.tr)$/ },
  { name: "Brave", re: /^search\.brave\.com$/ },
  { name: "Qwant", re: /^(?:[\w-]+\.)*qwant\.com$/ },
  { name: "Ecosia", re: /^(?:[\w-]+\.)*ecosia\.org$/ },
  { name: "Sogou", re: /^(?:[\w-]+\.)*sogou\.com$/ },
  { name: "Naver", re: /^(?:[\w-]+\.)*naver\.com$/ },
  { name: "Yahoo", re: /^(?:[\w-]+\.)*yahoo\.(?:com|co\.jp)$/ },
];

export function searchEngineFor(host: string | null): string | null {
  if (!host) return null;
  for (const e of SEARCH_ENGINES) if (e.re.test(host)) return e.name;
  return null;
}

/** `en`, `zh`, … from a localized path; null for anything else. */
export function localeOf(uri: string): string | null {
  const m = uri.match(/^\/([a-z]{2}(?:-[A-Za-z]{2,4})?)(?:\/|$|\?)/);
  if (!m) return null;
  const candidate = m[1].toLowerCase();
  return SUPPORTED_LOCALES.has(candidate) ? candidate : null;
}

export const SUPPORTED_LOCALES = new Set(["en", "zh", "ja", "de", "fr", "es", "pt"]);

/** Path with trailing slash and query removed, for comparing against sitemap entries. */
export function normalizePath(uri: string): string {
  const path = uri.split("?")[0].split("#")[0];
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

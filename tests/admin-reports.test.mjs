// The four admin reports exist so that "how is the site doing" stops being a one-off pipeline
// of ad-hoc log parsing in a shell. The properties worth pinning are the ones that make a
// report trustworthy rather than merely non-empty: a request count is never presented as a
// user count or an indexed-page count, a bot that lies about its UA is still a bot, and an
// unreadable data source fails loudly instead of reporting zeros.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FileLogSource, MemoryLogSource } from "../src/lib/admin/source.ts";
import { parseWindow } from "../src/lib/admin/http.ts";
import {
  classifyBot,
  classifyTraffic,
  parseLine,
  searchEngineFor,
  localeOf,
} from "../src/lib/admin/logs.ts";
import { buildCrawlerReport, sitemapPaths } from "../src/lib/admin/crawler.ts";
import { buildUsersReport } from "../src/lib/admin/users.ts";
import { buildIndexingReport, countSitemapDirectives } from "../src/lib/admin/indexing.ts";

const JSON_LINE = (o) => JSON.stringify(o);
const COMBINED_LINE = (o) =>
  `${o.ip} - - [${o.time}] "GET ${o.uri} HTTP/1.1" ${o.status ?? 200} 1000 "${o.referer ?? "-"}" "${o.ua}"`;

const base = {
  time: "07/Nov/2026:03:00:00 +0000",
  status: 200,
};

const rec = (overrides = {}) => {
  const o = { ...base, ip: "1.2.3.4", uri: "/en", ua: "Mozilla/5.0", referer: "-", ...overrides };
  return o;
};

test("both log formats parse to the same shape", () => {
  const j = parseLine(
    JSON_LINE({
      t: "2026-11-07T03:00:00+00:00",
      ip: "1.2.3.4",
      method: "GET",
      uri: "/en/install",
      status: 200,
      bytes: 1234,
      referer: "https://www.google.com/",
      ua: "Mozilla/5.0",
    }),
  );
  const c = parseLine(COMBINED_LINE(rec({ uri: "/en/install", referer: "https://www.google.com/" })));

  for (const r of [j, c]) {
    assert.ok(r, "line should parse");
    assert.equal(r.ip, "1.2.3.4");
    assert.equal(r.uri, "/en/install");
    assert.equal(r.status, 200);
    assert.equal(r.referer, "https://www.google.com/");
    assert.equal(r.ua, "Mozilla/5.0");
  }
  // The combined format's date is not ISO; it must still land on the right day.
  assert.equal(c.at.slice(0, 10), "2026-11-07");
  assert.equal(j.at.slice(0, 10), "2026-11-07");
});

test("a line that is neither format is dropped, not guessed at", () => {
  assert.equal(parseLine(""), null);
  assert.equal(parseLine("garbage"), null);
  assert.equal(parseLine("{not json"), null);
  assert.equal(parseLine('{"t":"2026-11-07T00:00:00Z"}'), null, "missing uri");
});

test("a JSON line with no path is dropped rather than counted as the homepage", () => {
  // Defaulting a missing path to "/" would turn a malformed line into a homepage hit, which is
  // a guess presented as a measurement. Dropping the line is the only honest option: nothing
  // in it says which page was requested.
  assert.equal(parseLine('{"t":"2026-11-07T00:00:00Z","uri":""}'), null);
  assert.equal(parseLine('{"t":"2026-11-07T00:00:00Z"}'), null);
  assert.equal(parseLine('{"t":"2026-11-07T00:00:00Z","uri":"/en"}')?.uri, "/en");
});

test("all three log-backed reports run end to end over a real file", async (t) => {
  // The unit tests above feed records in memory. This one goes through FileLogSource, which is
  // the path production uses: reads rotated siblings, parses both formats, applies the window.
  // A private directory per run keeps parallel test files from deleting each other's fixture.
  const dir = mkdtempSync(join(tmpdir(), "gu-admin-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const line = (o) => JSON.stringify(o) + "\n";
  writeFileSync(
    join(dir, "gpu-unlock-access.log"),
    line({ t: "2026-11-07T01:00:00+00:00", ip: "66.249.66.1", uri: "/en", status: 200, ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" }) +
      line({ t: "2026-11-07T02:00:00+00:00", ip: "66.249.66.1", uri: "/zh", status: 200, ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" }) +
      line({ t: "2026-11-07T03:00:00+00:00", ip: "1.2.3.4", uri: "/en", status: 200, referer: "https://www.google.com/", ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/156.0" }) +
      line({ t: "2026-11-07T04:00:00+00:00", ip: "5.6.7.8", uri: "/zh", status: 200, ua: "Mozilla/5.0 (Macintosh) Version/17.4 Safari/605.1.15" }) +
      line({ t: "2026-11-07T05:00:00+00:00", ip: "127.0.0.1", uri: "/en", status: 200, ua: "node" }),
  );

  const source = new FileLogSource({ dir, file: "gpu-unlock-access.log" });
  const window = { from: null, to: null };
  const fetchText = async (url) =>
    url.endsWith("robots.txt")
      ? "User-agent: *\nSitemap: https://gpu-unlock.com/sitemap.xml\n"
      : "<urlset><url><loc>https://gpu-unlock.com/en</loc></url><url><loc>https://gpu-unlock.com/zh</loc></url></urlset>";

  const crawler = await buildCrawlerReport(source, window, {
    site: "gpu-unlock.com",
    sitemapUrl: "https://gpu-unlock.com/sitemap.xml",
    fetchText,
  });
  assert.equal(crawler.totalRequests.value, 5);
  assert.equal(crawler.botRequests.value, 2);
  assert.equal(crawler.humanRequests.value, 2, "the node line is neither bot nor reader");
  assert.deepEqual(crawler.sitemapCoverage.neverCrawled, []);

  const users = await buildUsersReport(source, window, {
    site: "gpu-unlock.com",
    ownHosts: ["gpu-unlock.com"],
  });
  assert.equal(users.requests.value, 2);
  assert.equal(users.uniqueIps.value, 2);
  assert.deepEqual(users.entrySources.externalTop, [{ host: "google.com", visits: 1 }]);
  assert.equal(
    users.excludedTraffic.reduce((sum, e) => sum + e.requests, 0),
    3,
    "two crawler lines and one own-script line",
  );

  const indexing = await buildIndexingReport(source, window, {
    site: "gpu-unlock.com",
    sitemapUrl: "https://gpu-unlock.com/sitemap.xml",
    robotsUrl: "https://gpu-unlock.com/robots.txt",
    fetchText,
  });
  assert.equal(indexing.sitemap.urlCount, 2);
  assert.equal(indexing.robots.sitemapDirectives, 1);
  assert.equal(indexing.indexedPages, null);
  assert.deepEqual(indexing.searchReferrals, [{ engine: "Google", visits: 1 }]);
});

test("this host's own scripts are excluded from reader traffic", async () => {
  // verify-deployment.mjs and patrol-live.mjs hit the site as `node` with no bot token. Before
  // this, ~4,500 requests a fortnight were reported as readers.
  const own = {
    at: "2026-11-07T03:00:00.000Z",
    ip: "127.0.0.1",
    method: "GET",
    uri: "/en",
    status: 200,
    bytes: 0,
    referer: "",
    ua: "node",
  };
  // `node` has no bot token, so it is caught by the own-script check; `node-fetch/1.0` does
  // carry one and lands in the generic crawler bucket. Asserting both exactly, rather than
  // "not human", keeps a future regex change from silently reclassifying them as a person.
  assert.equal(classifyTraffic(own).kind, "disguised");
  const fetchUa = classifyTraffic({ ...own, ua: "node-fetch/1.0" });
  assert.equal(fetchUa.kind, "bot");
  assert.equal(fetchUa.label, "GenericCrawler");

  // And through the report that actually decides what a reader is: neither reaches the count.
  const source = new MemoryLogSource("test", [
    parseLine(JSON.stringify({ t: "2026-11-07T01:00:00+00:00", ip: "127.0.0.1", uri: "/en", status: 200, ua: "node" })),
    parseLine(JSON.stringify({ t: "2026-11-07T02:00:00+00:00", ip: "127.0.0.1", uri: "/en", status: 200, ua: "node-fetch/1.0" })),
    parseLine(JSON.stringify({ t: "2026-11-07T03:00:00+00:00", ip: "8.8.8.8", uri: "/en", status: 200, ua: "Mozilla/5.0 (X11) Chrome/156.0" })),
  ]);
  const report = await buildUsersReport(source, { from: null, to: null }, {
    site: "gpu-unlock.com",
    ownHosts: ["gpu-unlock.com"],
  });
  assert.equal(report.requests.value, 1, "only the browser is a reader");
  assert.equal(report.excludedTraffic.reduce((s, e) => s + e.requests, 0), 2);
  // A browser UA that merely contains the letters is untouched.
  assert.equal(classifyTraffic({ ...own, ip: "8.8.8.8", ua: "Mozilla/5.0 (X11) Chrome/156.0" }).kind, "human");
});

test("crawlers are recognised by UA, including ones that hide", () => {
  assert.equal(classifyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)").name, "Googlebot");
  assert.equal(classifyBot("Mozilla/5.0 (compatible; bingbot/2.0)").name, "Bingbot");
  assert.equal(classifyBot("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)").name, "GPTBot");
  assert.equal(classifyBot("ClaudeBot/1.0").name, "ClaudeBot");
  // A plain browser is not a bot.
  assert.equal(classifyBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0"), null);
});

test("traffic that is not human is excluded from user counts, with a reason", () => {
  // Google's proxy crawler presents a Nexus 5X browser UA. A UA-only filter counts it as a user.
  const disguised = {
    at: "2026-11-07T03:00:00.000Z",
    ip: "66.249.66.160",
    method: "GET",
    uri: "/en",
    status: 200,
    bytes: 0,
    referer: "",
    ua: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) Chrome/156.0 Mobile Safari/537.36",
  };
  const c = classifyTraffic(disguised);
  assert.equal(c.kind, "disguised");
  assert.match(c.label, /google/i);

  // The host's own scripts identify as `node`.
  assert.equal(classifyTraffic({ ...disguised, ip: "127.0.0.1", ua: "node" }).kind, "disguised");

  // Vulnerability scanners ask for paths no page has.
  assert.equal(
    classifyTraffic({ ...disguised, ip: "9.9.9.9", uri: "/wp-admin/install.php", ua: "Mozilla/5.0" }).kind,
    "scanner",
  );

  // And a real browser is still a human.
  assert.equal(
    classifyTraffic({ ...disguised, ip: "8.8.8.8", ua: "Mozilla/5.0 (Macintosh) Version/17.4 Safari/605.1.15" }).kind,
    "human",
  );
});

test("the window is validated instead of defaulting silently", () => {
  const now = new Date("2026-11-07T12:00:00Z");

  const ok = parseWindow(new URLSearchParams("days=7"), now);
  assert.equal(ok.ok, true);
  assert.equal(ok.window.from.toISOString().slice(0, 10), "2026-11-01");

  assert.equal(parseWindow(new URLSearchParams("days=0"), now).ok, false);
  assert.equal(parseWindow(new URLSearchParams("days=365"), now).ok, false);
  assert.equal(parseWindow(new URLSearchParams("days=abc"), now).ok, false);
  assert.equal(parseWindow(new URLSearchParams("days=7&from=2026-11-01"), now).ok, false);

  assert.equal(parseWindow(new URLSearchParams("from=nonsense"), now).ok, false);
  assert.equal(
    parseWindow(new URLSearchParams("from=2026-11-05&to=2026-11-01"), now).ok,
    false,
    "from after to is a mistake worth reporting",
  );

  // No parameters at all is a default window, not an error.
  const dflt = parseWindow(new URLSearchParams(""), now);
  assert.equal(dflt.ok, true);
  assert.equal(dflt.window.from.toISOString().slice(0, 10), "2026-11-01");
});

test("crawler report separates measured counts and labels coverage as coverage", async () => {
  const records = [
    // Googlebot, 3 requests
    ...[1, 2, 3].map((i) =>
      parseLine(JSON_LINE({ t: `2026-11-07T0${i}:00:00+00:00`, ip: "66.249.66.1", uri: "/en", status: 200, ua: "Mozilla/5.0 (compatible; Googlebot/2.1)" })),
    ),
    // Bingbot, 1 request
    parseLine(JSON_LINE({ t: "2026-11-07T04:00:00+00:00", ip: "1.2.3.4", uri: "/zh", status: 200, ua: "Mozilla/5.0 (compatible; bingbot/2.0)" })),
    // A human, 1 request
    parseLine(JSON_LINE({ t: "2026-11-07T05:00:00+00:00", ip: "8.8.8.8", uri: "/en/gpus", status: 200, ua: "Mozilla/5.0 (Macintosh) Version/17.4 Safari/605.1.15" })),
  ];
  const source = new MemoryLogSource("test", records);

  const report = await buildCrawlerReport(
    source,
    { from: new Date("2026-11-01"), to: new Date("2026-11-08") },
    {
      site: "gpu-unlock.com",
      sitemapUrl: "https://example.test/sitemap.xml",
      fetchText: async () =>
        `<?xml version="1.0"?><urlset><url><loc>https://gpu-unlock.com/en</loc></url><url><loc>https://gpu-unlock.com/zh</loc></url><url><loc>https://gpu-unlock.com/ja</loc></url></urlset>`,
    },
  );

  assert.equal(report.totalRequests.value, 5);
  assert.equal(report.botRequests.value, 4);
  assert.equal(report.humanRequests.value, 1);
  assert.equal(report.botRequests.confidence, "measured");
  assert.equal(report.humanRequests.confidence, "inferred", "a request count stands in for users");

  assert.equal(report.ranking[0].crawler, "Googlebot");
  assert.equal(report.ranking[0].requests, 3);
  assert.equal(report.ranking[1].crawler, "Bingbot");

  assert.ok(report.sitemapCoverage);
  assert.equal(report.sitemapCoverage.urls, 3);
  assert.equal(report.sitemapCoverage.crawledByGoogle.value, 1, "only /en was fetched by Googlebot");
  assert.equal(report.sitemapCoverage.neverCrawled.length, 1, "/en and /zh were both fetched");
  assert.ok(report.sitemapCoverage.neverCrawled.includes("/ja"));
});

test("crawler report survives an unreachable sitemap and says so", async () => {
  const source = new MemoryLogSource("test", [
    parseLine(JSON_LINE({ t: "2026-11-07T01:00:00+00:00", ip: "66.249.66.1", uri: "/en", status: 200, ua: "Googlebot/2.1" })),
  ]);
  const report = await buildCrawlerReport(
    source,
    { from: null, to: null },
    {
      site: "gpu-unlock.com",
      sitemapUrl: "https://example.test/sitemap.xml",
      fetchText: async () => {
        throw new Error("ECONNREFUSED");
      },
    },
  );

  assert.equal(report.sitemapCoverage, null, "no coverage claim without a sitemap");
  assert.ok(report.warnings.some((w) => w.includes("sitemap")));
  assert.equal(report.totalRequests.value, 1, "traffic facts still reported");
});

test("users report counts IPs, not sessions, and says which traffic it dropped", async () => {
  const records = [
    parseLine(JSON_LINE({ t: "2026-11-07T01:00:00+00:00", ip: "1.1.1.1", uri: "/en", status: 200, referer: "", ua: "Mozilla/5.0 (Macintosh) Version/17.4 Safari/605.1.15" })),
    parseLine(JSON_LINE({ t: "2026-11-07T02:00:00+00:00", ip: "1.1.1.1", uri: "/zh", status: 200, referer: "https://gpu-unlock.com/en", ua: "Mozilla/5.0 (Macintosh) Version/17.4 Safari/605.1.15" })),
    parseLine(JSON_LINE({ t: "2026-11-07T03:00:00+00:00", ip: "2.2.2.2", uri: "/en", status: 200, referer: "https://www.google.com/", ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/156.0" })),
    parseLine(JSON_LINE({ t: "2026-11-07T04:00:00+00:00", ip: "66.249.66.1", uri: "/en", status: 200, referer: "", ua: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) Chrome/156.0" })),
    parseLine(JSON_LINE({ t: "2026-11-07T05:00:00+00:00", ip: "3.3.3.3", uri: "/wp-admin/install.php", status: 404, referer: "", ua: "Mozilla/5.0" })),
  ];
  const source = new MemoryLogSource("test", records);

  const report = await buildUsersReport(source, { from: null, to: null }, {
    site: "gpu-unlock.com",
    ownHosts: ["gpu-unlock.com", "gpuunlock.com"],
  });

  assert.equal(report.requests.value, 3, "the disguised crawler and the scanner are excluded");
  assert.equal(report.requests.confidence, "measured");
  assert.equal(report.uniqueIps.value, 2);
  assert.equal(report.uniqueIps.confidence, "inferred", "IPs are not people");
  assert.match(report.uniqueIps.basis, /IP/i);

  assert.equal(report.entrySources.direct, 1);
  assert.equal(report.entrySources.internal, 1);
  assert.equal(report.entrySources.external, 1);
  assert.deepEqual(report.entrySources.externalTop.map((e) => e.host), ["google.com"]);

  const reasons = report.excludedTraffic.map((e) => e.reason).join(" ");
  assert.match(reasons, /67\.|crawler|disguise|google/i);
  assert.equal(report.excludedTraffic.reduce((s, e) => s + e.requests, 0), 2);
});

test("indexing report never invents an index count", async () => {
  const source = new MemoryLogSource("test", [
    parseLine(JSON_LINE({ t: "2026-11-07T01:00:00+00:00", ip: "8.8.8.8", uri: "/en", status: 200, referer: "https://cn.bing.com/search?q=x", ua: "Mozilla/5.0 (Macintosh) Version/17.4 Safari/605.1.15" })),
    parseLine(JSON_LINE({ t: "2026-11-07T02:00:00+00:00", ip: "8.8.4.4", uri: "/en", status: 200, referer: "https://www.google.com/", ua: "Mozilla/5.0 (Windows NT 10.0) Chrome/156.0" })),
  ]);

  const report = await buildIndexingReport(source, { from: null, to: null }, {
    site: "gpu-unlock.com",
    sitemapUrl: "https://gpu-unlock.com/sitemap.xml",
    robotsUrl: "https://gpu-unlock.com/robots.txt",
    fetchText: async (url) =>
      url.endsWith("robots.txt")
        ? "User-agent: *\nAllow: /\nsitemap: https://gpu-unlock.com/sitemap.xml\n"
        : `<urlset><url><loc>https://gpu-unlock.com/en</loc></url><url><loc>https://gpu-unlock.com/zh</loc></url></urlset>`,
  });

  assert.equal(report.sitemap.urlCount, 2);
  assert.equal(report.sitemap.reachable, true);
  assert.equal(report.robots.sitemapDirectives, 1);
  assert.equal(report.indexedPages, null, "there is no index count to report");
  assert.match(report.indexedPagesNote, /not available|Not available/);
  // One visit each, so the order is alphabetical rather than "whichever line came first".
  assert.deepEqual(
    report.searchReferrals.map((r) => r.engine),
    ["Bing", "Google"],
  );
});

test("indexing report keeps the facts it has when the sitemap is down", async () => {
  const source = new MemoryLogSource("test", [], ["log dir missing"]);
  const report = await buildIndexingReport(source, { from: null, to: null }, {
    site: "gpu-unlock.com",
    sitemapUrl: "https://gpu-unlock.com/sitemap.xml",
    robotsUrl: "https://gpu-unlock.com/robots.txt",
    fetchText: async (url) => {
      if (url.endsWith("sitemap.xml")) throw new Error("HTTP 500");
      return "User-agent: *\nSitemap: https://gpu-unlock.com/sitemap.xml\n";
    },
  });

  assert.equal(report.sitemap.reachable, false);
  assert.equal(report.sitemap.urlCount, null);
  assert.equal(report.robots.reachable, true, "a sitemap failure must not hide robots");
  assert.equal(report.robots.sitemapDirectives, 1);
  assert.ok(report.warnings.some((w) => w.includes("HTTP 500")));
  assert.ok(report.warnings.some((w) => w.includes("log dir missing")));
});

test("sitemap paths and directive counting handle real documents", () => {
  assert.deepEqual(
    sitemapPaths(`<?xml version="1.0"?><urlset>
      <url><loc>https://gpu-unlock.com/en</loc></url>
      <url><loc>https://gpu-unlock.com/zh/</loc></url>
      <url><loc> https://gpu-unlock.com/ja/install </loc></url>
    </urlset>`),
    ["/en", "/zh", "/ja/install"],
  );
  assert.deepEqual(sitemapPaths("<urlset></urlset>"), []);
  assert.equal(
    countSitemapDirectives("# comment\nUser-agent: *\n  sitemap : https://a/x.xml\nSITEMAP: https://a/y.xml\n"),
    2,
  );
  assert.equal(countSitemapDirectives("User-agent: *\n# Sitemap: ignored\n"), 0);
});

test("locale extraction only recognises supported locales", () => {
  assert.equal(localeOf("/en/gpus"), "en");
  assert.equal(localeOf("/zh"), "zh");
  assert.equal(localeOf("/ja/"), "ja");
  assert.equal(localeOf("/xx/gpus"), null, "an unknown prefix is not a locale");
  assert.equal(localeOf("/gpus/rtx-4080"), null);
});

test("search engine matching does not mistake other hosts for engines", () => {
  assert.equal(searchEngineFor("google.com"), "Google");
  assert.equal(searchEngineFor("www.google.com.hk"), "Google");
  assert.equal(searchEngineFor("cn.bing.com"), "Bing");
  assert.equal(searchEngineFor("duckduckgo.com"), "DuckDuckGo");
  assert.equal(searchEngineFor("forum.spaziogames.it"), null);
  assert.equal(searchEngineFor(null), null);
});

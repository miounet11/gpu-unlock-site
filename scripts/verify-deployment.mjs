#!/usr/bin/env node
// Verifies that a deployed site serves every URL its own sitemap lists.
//
// The failure this catches is the one that is invisible locally: the sitemap is generated from
// data, the pages are generated from the same data through a different code path, and a change
// to one predicate can leave a listed URL returning 404. Search Console reports that weeks
// later; this reports it in a minute.
//
// Read-only. It writes nothing and needs no credentials.
//
// Usage:
//   node scripts/verify-deployment.mjs                 # checks https://gpu-unlock.com
//   node scripts/verify-deployment.mjs --base http://localhost:3100
//   node scripts/verify-deployment.mjs --locale en --limit 20
//
// Exit codes:
//   0  every sitemap URL returned 200 and the sitemap itself is reachable
//   1  at least one URL failed
//   2  the check could not run (sitemap unreachable, bad arguments)

const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const BASE = arg("base", "https://gpu-unlock.com").replace(/\/$/, "");
const ONLY_LOCALE = arg("locale", "");
const LIMIT = Number(arg("limit", "0")) || 0;
const TIMEOUT_MS = Number(arg("timeout", "15000")) || 15000;

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  let sitemapUrl;
  try {
    const res = await fetchWithTimeout(`${BASE}/sitemap.xml`);
    if (!res.ok) {
      console.error(`sitemap: HTTP ${res.status} from ${BASE}/sitemap.xml`);
      process.exit(2);
    }
    sitemapUrl = await res.text();
  } catch (err) {
    console.error(`sitemap: cannot reach ${BASE}/sitemap.xml (${err.message})`);
    process.exit(2);
  }

  let urls = [...sitemapUrl.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (urls.length === 0) {
    console.error("sitemap: no <loc> entries found");
    process.exit(2);
  }

  if (ONLY_LOCALE) {
    urls = urls.filter((u) => u.includes(`/${ONLY_LOCALE}/`));
  }
  if (LIMIT > 0) {
    urls = urls.slice(0, LIMIT);
  }

  console.log(`checking ${urls.length} URL(s) against ${BASE}`);

  const failures = [];
  let checked = 0;

  for (const url of urls) {
    // The deployed host may differ from the canonical one (preview, localhost). Only the path
    // is checked; the host in the sitemap is the canonical host by definition.
    const path = new URL(url).pathname;
    const target = `${BASE}${path}`;
    try {
      const res = await fetchWithTimeout(target);
      checked += 1;
      // A redirect on a canonical URL means the sitemap and the routing disagree; report it
      // rather than following it, because following would hide the disagreement.
      if (res.status !== 200) {
        failures.push({ path, status: res.status, location: res.headers.get("location") });
      }
    } catch (err) {
      checked += 1;
      failures.push({ path, status: "error", location: err.message });
    }
  }

  if (failures.length === 0) {
    console.log(`ok: ${checked} URL(s) served 200`);
    return;
  }

  console.error(`\n${failures.length} of ${checked} failed:`);
  for (const f of failures.slice(0, 40)) {
    const extra = f.location ? ` -> ${f.location}` : "";
    console.error(`  ${f.status} ${f.path}${extra}`);
  }
  if (failures.length > 40) console.error(`  ... and ${failures.length - 40} more`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

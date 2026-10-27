// IndexNow submission for gpu-unlock.com.
//
// Keep this in the repo rather than on the server only, and read the URLs from the site's own
// sitemap: the sitemap is derived from the card and benchmark data, so a hand-kept list here
// silently stops matching the moment a card or a mode is added. That already happened once —
// commit 4c321d2 started serving 350 URLs while this script still submitted the 42 hubs.
//
//   node deploy/indexnow.mjs
//   node deploy/indexnow.mjs --base http://127.0.0.1:3191
//
// Reads the live sitemap, so it reports what is actually deployed. Exits non-zero if the key
// file or the sitemap is not being served, because the submission would be rejected anyway
// and a green exit would hide that.

const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const SITE = arg("base", "https://gpu-unlock.com").replace(/\/$/, "");
const KEY = "fe762070f9f94699958963f0e664db51";

const keyLocation = `${SITE}/${KEY}.txt`;
const keyResponse = await fetch(keyLocation);
console.log(`key file: ${keyResponse.status === 200 ? "ok" : `MISSING (${keyResponse.status})`}`);
if (keyResponse.status !== 200) process.exit(1);

const sitemapResponse = await fetch(`${SITE}/sitemap.xml`);
if (!sitemapResponse.ok) {
  console.error(`sitemap: HTTP ${sitemapResponse.status} from ${SITE}/sitemap.xml`);
  process.exit(2);
}
const urlList = [...(await sitemapResponse.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim());
if (urlList.length === 0) {
  console.error("sitemap: no <loc> entries found; refusing to submit an empty list");
  process.exit(2);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "gpu-unlock.com", key: KEY, keyLocation, urlList }),
});

console.log(`indexnow ${response.status} — ${urlList.length} urls — ${(await response.text()).slice(0, 180)}`);
process.exit(response.ok ? 0 : 1);

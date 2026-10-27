// IndexNow submission for gpu-unlock.com.
//
// Keep this in the repo rather than on the server only: the URL list has to follow the hubs
// this site actually serves, and a stale list silently leaves new pages unsubmitted.
//
//   node deploy/indexnow.mjs
//
// Exits non-zero if the key file is not being served, because the submission would be
// rejected anyway and a green exit would hide that.


const SITE = "https://gpu-unlock.com";
const KEY = "fe762070f9f94699958963f0e664db51";
const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];
// This site serves the hubs and the card pages; the reference site keeps its own coverage.
// Add a new hub or card slug here when it ships, or crawlers will not hear about it.
const HUBS = ["", "/install", "/windows", "/gpus", "/benchmarks", "/faq"];

const keyLocation = `${SITE}/${KEY}.txt`;
const keyResponse = await fetch(keyLocation);
console.log(`key file: ${keyResponse.status === 200 ? "ok" : `MISSING (${keyResponse.status})`}`);
if (keyResponse.status !== 200) process.exit(1);

const urlList = LOCALES.flatMap((locale) =>
  HUBS.map((hub) => `${SITE}/${locale}${hub}`),
);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "gpu-unlock.com", key: KEY, keyLocation, urlList }),
});

console.log(`indexnow ${response.status} — ${urlList.length} urls — ${(await response.text()).slice(0, 180)}`);
process.exit(response.ok ? 0 : 1);

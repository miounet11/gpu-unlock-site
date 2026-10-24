// IndexNow submission for gpu-unlock.com.
//
// Keep this in the repo rather than on the server only: the URL list has to follow
// src/data/devices.ts, and a stale list silently leaves new card pages unsubmitted.
//
//   node deploy/indexnow.mjs
//
// Exits non-zero if the key file is not being served, because the submission would be
// rejected anyway and a green exit would hide that.


const SITE = "https://gpu-unlock.com";
const KEY = "fe762070f9f94699958963f0e664db51";
const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];
const HUBS = ["", "/install", "/faq"];

// The card pages live on the reference site now, so this site has no card slugs to submit.
const built = [];

const keyLocation = `${SITE}/${KEY}.txt`;
const keyResponse = await fetch(keyLocation);
console.log(`key file: ${keyResponse.status === 200 ? "ok" : `MISSING (${keyResponse.status})`}`);
if (keyResponse.status !== 200) process.exit(1);

const urlList = LOCALES.flatMap((locale) => [
  ...HUBS.map((hub) => `${SITE}/${locale}${hub}`),
  ...built.map((slug) => `${SITE}/${locale}/gpus/${slug}`),
]);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: "gpu-unlock.com", key: KEY, keyLocation, urlList }),
});

console.log(`indexnow ${response.status} — ${urlList.length} urls — ${(await response.text()).slice(0, 180)}`);
process.exit(response.ok ? 0 : 1);

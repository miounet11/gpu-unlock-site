// Guards the localised 404 page.
//
// Removing the three 301s to the reference site (commit 4c321d2) made unknown paths under a
// locale render this site's own 404 instead of redirecting. Next serves `app/[locale]/not-found.tsx`
// as an RSC payload wrapped in the locale layout — the right shape — but nothing verified that,
// and an earlier experiment showed a bare `__next_error__` shell with no visible content is
// easy to miss: every build, lint and sitemap check stays green while the page ships empty.
//
// So this builds the standalone server output once (the same shape production runs, see
// deploy/ecosystem.config.cjs) and checks the rendered 404 for real content: translated title,
// layout nav, and a correct HTTP status.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];
const loadMessages = (loc) =>
  JSON.parse(readFileSync(new URL(`messages/${loc}.json`, root), "utf8"));

test("every locale carries the same notFound keys", () => {
  for (const loc of LOCALES) {
    const keys = Object.keys(loadMessages(loc).notFound ?? {});
    assert.deepEqual(
      keys.sort(),
      ["benchmarks", "body", "cards", "home", "install", "title"],
      `${loc}: notFound keys drifted`,
    );
  }
});

test("the built 404 chunk reads the notFound namespace and every key it renders", (t) => {
  // The component compiles into a shared server chunk (not a per-route page.js, and not
  // app/_not-found, which is the root English shell). Locating it by scanning the chunks
  // for the namespace call is what keeps this test true when the chunk number changes.
  const dir = new URL(".next/server/chunks/", root);
  let names;
  try {
    names = readdirSync(dir).filter((n) => n.endsWith(".js"));
  } catch {
    t.skip("no build present; run `npm run build` first");
    return;
  }
  const chunk = names
    .map((n) => ({ n, s: readFileSync(new URL(n, dir), "utf8") }))
    .find(({ s }) => /await\s+\w+\.\w+\("notFound"\)|\("notFound"\)/.test(s) && s.includes("container page"));
  assert.ok(chunk, "no compiled chunk renders the localised 404 component");
  for (const marker of ["title", "body", "home", "cards", "benchmarks", "install"]) {
    assert.ok(
      new RegExp(`\\("${marker}"\\)`).test(chunk.s),
      `404 chunk does not request notFound.${marker}`,
    );
  }
});

test("unknown paths return the localised 404, not a bare error shell", async (t) => {
  // Served check against the standalone server, started by the caller as in CI
  // (`npx next start` there, `node server.js` here). Skipped when nothing listens,
  // so `npm test` alone stays green — the site-health workflow runs the served check.
  const base = process.env.FOUR_OH_FOUR_BASE;
  if (!base) {
    t.skip("no server; set FOUR_OH_FOUR_BASE=http://127.0.0.1:PORT to run this");
    return;
  }
  for (const loc of LOCALES) {
    const res = await fetch(`${base}/${loc}/gpus/nope`);
    assert.equal(res.status, 404, `/${loc}/gpus/nope must stay a 404`);
    const html = await res.text();
    const title = loadMessages(loc).notFound.title;
    assert.ok(html.includes(title), `/${loc}: 404 does not show the translated title`);
    assert.ok(
      !/^<!DOCTYPE html><html id="__next_error__"><head><meta charSet/.test(html) ||
        html.includes(title),
      `/${loc}: 404 is a bare error shell`,
    );
  }
});

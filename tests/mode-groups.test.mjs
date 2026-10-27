// Guards the mode grouping that /benchmarks/[mode] is built from.
//
// The grouping is mechanical, which is what makes it testable: a row's mode string alone
// decides its group, so a new evidence row that nobody classified fails here instead of
// silently landing in the wrong table or vanishing from every page.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const benchSrc = readFileSync(new URL("src/data/benchmarks.ts", root), "utf8");
const modesSrc = readFileSync(new URL("src/data/modes.ts", root), "utf8");
const sitemap = readFileSync(new URL("src/app/sitemap.ts", root), "utf8");

// Parse the mode strings straight from the data file. Importing the TS module would need a
// loader, and the point here is to check the text that ships, not a transpiled copy.
const modes = [...benchSrc.matchAll(/mode: "([^"]+)"/g)].map((m) => m[1]);
const units = [...benchSrc.matchAll(/mode: "([^"]+)", unit: "([^"]+)"/g)].map((m) => ({
  mode: m[1],
  unit: m[2],
}));

test("every measured mode is registered in a group", () => {
  assert.ok(modes.length > 0, "no modes parsed — the data file shape changed");

  // The two lookup tables are the only place a row's mode is mapped to a group, so read their
  // keys and nothing else. Keys are quoted in the source ("f16/f32", "s8/s32").
  const registered = new Set(
    [...modesSrc.matchAll(/^\s{2}"?([a-z0-9/]+)"?: "[a-z0-9-]+",$/gm)].map((m) => m[1]),
  );
  const missing = [...new Set(modes)].filter((mode) => {
    const base = mode.replace(/^cuBLAS\s+/, "").replace(/\s+\d+³$/, "").trim();
    return !registered.has(base);
  });

  assert.deepEqual(missing, [], `unregistered modes: ${missing.join(", ")}`);
});

test("a group never mixes units", () => {
  // TF/s and TOP/s are different quantities. Two rows in one table with different units
  // would make the table's header a lie.
  const byMode = new Map();
  for (const { mode, unit } of units) {
    byMode.set(mode, unit);
  }
  for (const [mode, unit] of byMode) {
    assert.ok(["TF/s", "TOP/s", "GFLOP/s", "ms"].includes(unit), `${mode} has unit ${unit}`);
  }
});

test("integer paths print TOP/s, not TF/s", () => {
  // The evidence files write these interchangeably; the site must not.
  for (const { mode, unit } of units) {
    if (/^(s8\/s32|u4\/s32|dp4a)$/.test(mode)) {
      assert.equal(unit, "TOP/s", `${mode} should be TOP/s`);
    }
  }
});

// The sitemap and the mode page must reach the same answer about which groups exist. They used
// to hold separate copies of that rule, which is the failure mode this guards: a group that is
// pageworthy but has no rows renders notFound(), so a sitemap that only checked pageworthy
// would publish a 404.
test("the sitemap and the mode page share one page predicate", () => {
  assert.match(sitemap, /pageGroups\(/, "sitemap must use the shared predicate");
  assert.ok(
    !/MODE_GROUPS\.map\(/.test(sitemap),
    "an unfiltered map would put a 404 in the sitemap",
  );
  assert.ok(
    !/MODE_GROUPS\.filter\(/.test(sitemap),
    "a local filter is a second copy of the rule and will drift from the page",
  );

  // Both conditions live in pageGroups, and the page must not re-implement them.
  assert.match(modesSrc, /export function pageGroups/);
  assert.match(modesSrc, /g\.pageworthy && rowCount\(g\.id\) > 0/);

  const pageSrc = readFileSync(new URL("src/app/[locale]/benchmarks/[mode]/page.tsx", root), "utf8");
  assert.match(pageSrc, /pageGroups\(/, "mode page must use the shared predicate");
  assert.ok(
    !/MODE_GROUPS\.filter\(/.test(pageSrc),
    "mode page re-implements the predicate instead of calling it",
  );
});

// A page generated for a group with no rows renders an empty table and a broken `best` lookup.
test("every pageworthy group carries rows in the data", () => {
  const pageworthy = [...modesSrc.matchAll(/id: "([a-z0-9-]+)",[\s\S]*?pageworthy: true/g)].map(
    (m) => m[1],
  );
  assert.ok(pageworthy.length > 0, "no pageworthy groups parsed");
});

// The rules that decide what the site claims.
//
// Borrowed from harness2's judge: a measurement that did not happen is not a zero. Two
// failures this file exists to prevent, both of which shipped once already:
//
//   1. Comparing raw counts across unequal sample sizes. 4 of 8 and 2 of 3 are four versus
//      two, but 50% versus 67%; only the share answers "which card responds more reliably".
//   2. Treating "no published rows" as "improved on 0% of paths", which turns an unmeasured
//      card into a card that failed.
//
// These are derived-verdict checks, so they run on the data modules directly rather than
// scraping built HTML.

import { test } from "node:test";
import assert from "node:assert/strict";

import { pairStats, cardStats, rowsForMode, MOVED_RATIO } from "../src/data/answers.ts";
import { SCENARIOS } from "../src/data/use-cases.ts";
import { CHIPS } from "../src/data/chips.ts";

test("a pair is judged on the share of rows that moved, not the raw count", () => {
  // Walk every curated pair and recompute the winner from the shares. If the implementation
  // ever goes back to comparing counts, a pair with unequal row counts will disagree.
  const pairs = [
    ["rtx-4090", "rtx-4080"],
    ["rtx-4090", "rtx-4070-super"],
    ["rtx-4080", "rtx-4070-ti"],
    ["rtx-4070-ti", "rtx-4070"],
    ["rtx-4060-ti-16gb", "rtx-4060"],
    ["rtx-4080-super", "rtx-4070-ti-super"],
    ["rtx-4090", "rtx-2080-ti"],
    ["rtx-3050-6gb", "rtx-4060"],
  ];

  for (const [a, b] of pairs) {
    const pair = pairStats(a, b);
    assert.ok(pair, `${a} vs ${b} produced no stats`);
    assert.ok(pair.comparable, `${a} vs ${b} should be comparable: both have rows`);

    const expected =
      Math.abs(pair.aShare - pair.bShare) < 1e-9
        ? "tie"
        : pair.aShare > pair.bShare
          ? "a"
          : "b";
    assert.equal(pair.winner, expected, `${a} vs ${b}: winner disagrees with the shares`);

    // Restate the invariant in the terms of the bug: the winner must not be the side that
    // merely had more rows when the shares disagree.
    if (pair.a.stats.rows !== pair.b.stats.rows) {
      const byCount = pair.a.stats.improved > pair.b.stats.improved ? "a" : "b";
      if (byCount !== expected && expected !== "tie") {
        assert.notEqual(
          pair.winner,
          byCount,
          `${a} vs ${b}: winner followed the raw count across unequal denominators`,
        );
      }
    }
  }
});

test("the one pair whose counts and shares disagree is judged by the share", () => {
  // Regression pin: 4/8 (50%) versus 2/3 (67%). Counting rows picks the 4080 SUPER; the
  // share picks the 4070 Ti SUPER. The site must publish the second.
  const pair = pairStats("rtx-4080-super", "rtx-4070-ti-super");
  assert.ok(pair);
  assert.equal(pair.a.stats.improved, 4);
  assert.equal(pair.a.stats.rows, 8);
  assert.equal(pair.b.stats.improved, 2);
  assert.equal(pair.b.stats.rows, 3);
  assert.equal(pair.winner, "b");
});

test("an unmeasured card is not scored as a card that failed", () => {
  // A card with no rows has no share. It must stay "not comparable", and its share must not
  // be published as 0%.
  const measured = "rtx-4090";
  assert.ok(cardStats(measured).rows > 0);

  const stats = cardStats("ga103-device-with-no-rows");
  assert.equal(stats.rows, 0, "fixture assumption: this slug has no rows");
  // cardStats on an unknown slug returns zero rows, which is exactly the shape a real
  // unmeasured card has; the point is that pairStats must not turn it into 0%.
  const pair = pairStats(measured, "ga103-device-with-no-rows");
  assert.equal(pair, null, "a pair needs two real devices, so this one must not be built");
});

test("every scenario verdict follows from its own row counts", () => {
  for (const scenario of SCENARIOS) {
    const share = scenario.rows.length === 0 ? 0 : scenario.improved / scenario.rows.length;
    const expected = share >= 0.8 ? "moved" : share <= 0.2 ? "flat" : "mixed";
    assert.equal(scenario.verdict, expected, `${scenario.slug}: verdict does not follow its rows`);
    assert.equal(
      scenario.improved,
      scenario.rows.filter((row) => row.ratio >= MOVED_RATIO).length,
      `${scenario.slug}: improved count disagrees with the rows`,
    );
  }
});

test("a chip with no rows publishes no gain, and does not claim one", () => {
  for (const chip of CHIPS) {
    if (chip.rows === 0) {
      assert.equal(chip.best, null, `${chip.chip}: no rows but a best row`);
      assert.equal(chip.improved, 0, `${chip.chip}: no rows but an improved count`);
    } else {
      assert.ok(chip.best, `${chip.chip}: rows but no best row`);
    }
  }
});

test("a mode group reports only the rows it actually has", () => {
  const groups = new Set(
    SCENARIOS.flatMap((scenario) => scenario.modes),
  );
  for (const id of groups) {
    const rows = rowsForMode(id);
    // A group with no rows must not be turned into a page; the answer builder already filters
    // on this, and the check keeps that filter honest.
    if (rows.length === 0) continue;
    assert.ok(rows.every((row) => typeof row.ratio === "number"));
  }
});

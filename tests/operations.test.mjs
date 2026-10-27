// Guards the operational layer: the scripts a scheduled job runs and the headers the site sends.
//
// These are the checks nobody runs by hand. A scheduled workflow that has drifted from the
// script it calls, or a header block that was removed in a refactor, looks fine locally and
// fails months later. Each test here is cheap and pins a fact the workflow relies on.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");

const pkg = JSON.parse(read("package.json"));
const workflow = read(".github/workflows/site-health.yml");
const nextConfig = read("next.config.ts");

test("every script the workflow calls exists and is wired", () => {
  // A workflow step that names a path directly is a rename away from breaking silently.
  const referenced = [...workflow.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)].map((m) => m[1]);
  assert.ok(referenced.length >= 2, `expected the two scripts, saw ${referenced.length}`);

  for (const file of referenced) {
    assert.ok(existsSync(new URL(file, root)), `${file} is referenced by CI but missing`);
  }
});

test("the npm scripts the workflow runs are declared", () => {
  for (const name of ["lint", "test", "build"]) {
    assert.ok(pkg.scripts[name], `npm run ${name} is used by CI but not declared`);
  }
  // check:upstream and check:deploy are the two ops entry points; both must stay runnable.
  assert.match(pkg.scripts["check:upstream"] ?? "", /scripts\/check-upstream-pins\.mjs/);
  assert.match(pkg.scripts["check:deploy"] ?? "", /scripts\/verify-deployment\.mjs/);
});

test("the drift checks run on a schedule, not on every push", () => {
  // Upstream moving is not a build failure. If these ran on push, a red badge would mean
  // "upstream released" and the signal would be lost.
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /schedule.*workflow_dispatch|workflow_dispatch/s);

  for (const job of ["upstream", "deployed"]) {
    const block = workflow.split(new RegExp(`^\\s{2}${job}:`, "m"))[1] ?? "";
    assert.match(
      block,
      /if:.*schedule/,
      `${job} job must be limited to the schedule or a manual run`,
    );
  }
});

test("the deployment check probes the live host, not a guessed one", () => {
  const script = read("scripts/verify-deployment.mjs");
  assert.match(script, /gpu-unlock\.com/, "default base should be the canonical host");
  // The whole point is comparing the sitemap against what the host actually serves.
  assert.match(script, /sitemap\.xml/);
  assert.match(script, /process\.exit\(1\)/);
});

// The submission list has to track what the site actually serves. It was hand-kept once and
// fell 308 URLs behind the day the card and benchmark pages moved onto this host — the pages
// existed, the sitemap listed them, and the script announced only the six hubs.
test("the indexnow submission reads the sitemap instead of a hand-kept list", () => {
  const script = read("deploy/indexnow.mjs");
  assert.match(script, /sitemap\.xml/, "indexnow must take its URL list from the sitemap");
  assert.match(script, /<loc>/, "indexnow parses <loc> entries");
  assert.ok(
    !/const HUBS\s*=/.test(script),
    "a hardcoded hub list drifts from the data-derived sitemap; read the sitemap instead",
  );
  assert.match(script, /process\.exit\(2\)/, "an empty or unreachable sitemap must fail loudly");
});

test("security headers are still declared for every path", () => {
  for (const [key, value] of [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["X-Frame-Options", "SAMEORIGIN"],
  ]) {
    assert.ok(
      nextConfig.includes(`key: "${key}", value: "${value}"`),
      `${key} header is missing or changed`,
    );
  }
  // A headers() block scoped to a narrow source would silently skip the rest of the site.
  assert.match(nextConfig, /source: "\/:path\*"/);
  assert.match(nextConfig, /poweredByHeader: false/);
});

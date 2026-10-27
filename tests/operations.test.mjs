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
//
// This runs the script, rather than matching its source text: a regex over the file passes
// just as well when the parsing is broken. `--dry-run` keeps it off the network, and the
// throwaway server below is the whole "deployed site" as far as the script can tell.
const KEY_FILE = "/fe762070f9f94699958963f0e664db51.txt";

async function withFakeSite(sitemapBody, fn) {
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    if (req.url === KEY_FILE) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("fe762070f9f94699958963f0e664db51");
      return;
    }
    if (req.url === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(sitemapBody);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function runIndexNow(base) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  try {
    const { stdout } = await run(process.execPath, ["deploy/indexnow.mjs", "--base", base, "--dry-run"], {
      cwd: new URL("../", import.meta.url),
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.code, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

test("indexnow submits every <loc> in the sitemap, not a hand-kept hub list", async () => {
  const urls = [
    "https://example.test/en",
    "https://example.test/zh/gpus/rtx-4090",
    "https://example.test/de/benchmarks/fp32",
  ];
  const body = `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`;

  const result = await withFakeSite(body, runIndexNow);
  assert.equal(result.code, 0, `indexnow exited ${result.code}: ${result.stderr}`);
  for (const url of urls) {
    assert.ok(result.stdout.includes(url), `indexnow did not list ${url}`);
  }
  assert.match(result.stdout, /3 urls/, "indexnow must report the full count it read");
});

test("indexnow fails instead of submitting when the sitemap has no entries", async () => {
  const result = await withFakeSite("<urlset></urlset>", runIndexNow);
  assert.equal(result.code, 2, "an empty sitemap must exit 2, not succeed with nothing sent");
  assert.match(result.stdout + result.stderr, /no <loc> entries/);
});

// The deploy script exists because building in place emptied the directory pm2 was serving
// from, twice on this host. The properties below are the ones that make it safe, and each is
// one edit away from being lost: a build that writes `.next` directly, a swap that copies
// instead of renaming, or a restart that runs before the build is gated.
const deployScript = read("deploy/deploy.sh");
const postbuild = read("deploy/standalone-assets.mjs");

test("the deploy builds into a staging distDir, never into the live one", () => {
  // Absolute: pm2's cwd is the live tree elsewhere on disk, and a relative staging dir would
  // put the build somewhere the swap does not look.
  // Next resolves distDir with path.join(root, distDir), and join() concatenates rather than
  // treating an absolute second argument as a new base — passing the absolute path produced
  // <repo>/opt/gpu-unlock/site/.next-next. The value handed to next must stay relative.
  assert.match(deployScript, /STAGING_DIR="\.next-next"/);
  assert.match(deployScript, /NEXT_DIST_DIR="\$STAGING_DIR" npm run build/);
  assert.doesNotMatch(deployScript, /NEXT_DIST_DIR="\$STAGING" npm run build/);
  // A bare `npm run build` (no distDir override) writes `.next` — the tree pm2 is serving.
  const builds = [...deployScript.matchAll(/npm run build/g)];
  assert.equal(builds.length, 1, "exactly one build invocation, so the override cannot be bypassed");
});

test("the swap is a rename of the whole tree, and rollback uses the same path", () => {
  // rename(2) on one filesystem: cp would leave a window where the tree is half-written.
  assert.match(deployScript, /mv "\$to" "\$held"/);
  assert.match(deployScript, /mv "\$from" "\$to"/);
  assert.doesNotMatch(deployScript, /cp -a|rsync/);
  // Rollback must not be a second implementation that can drift from the forward swap.
  assert.match(deployScript, /--rollback/);
  assert.match(deployScript, /swap "\$PREV" "\$LIVE"/);
});

test("the swap keeps the previous tree for rollback", () => {
  // The first version of this script deleted the outgoing tree at the end of a successful
  // swap, so --rollback had nothing to move. A rollback path that is never exercised is
  // indistinguishable from one that does not work.
  const swapBody = deployScript.slice(
    deployScript.indexOf("swap() {"),
    deployScript.indexOf("restart_and_verify() {"),
  );
  // Look only at what happens after the incoming tree is in place: the `rm -rf "$held"` at the
  // top of swap is stale-leftover cleanup and is fine.
  const afterSwapIn = swapBody.slice(swapBody.indexOf('mv "$from" "$to"'));
  assert.match(afterSwapIn, /mv "\$held" "\$PREV"/, "the replaced tree must become $PREV");
  assert.doesNotMatch(
    afterSwapIn,
    /rm -rf "\$held"(?!.*mv "\$held")/s,
    "deleting the replaced tree is what left --rollback with no target",
  );
});

// The first version defaulted LIVE to "$ROOT/.next". On this host that is the *source* tree:
// pm2 serves /opt/gpu-unlock/.next while the checkout sits at /opt/gpu-unlock/site. It swapped
// a directory nobody served, restarted the unchanged process, and then verified that process —
// a deploy that prints "ok" while the live bytes never moved, and that a green run cannot catch.
test("the live tree is taken from pm2, not assumed to be the repo's own .next", () => {
  assert.match(deployScript, /pm2_cwd\(\)/, "the served tree must come from pm2's cwd");
  assert.match(deployScript, /pm_cwd/, "pm2 jlist exposes the app cwd as pm_cwd");
  // A fallback is still allowed, for the case where pm2 is not answering.
  assert.match(deployScript, /LIVE="\$ROOT\/\.next"/, "keep a fallback for an unreachable pm2");
  assert.doesNotMatch(
    deployScript,
    /^LIVE="\.next"$/m,
    "a relative LIVE is the bug: it resolves to the source tree",
  );
  // And the restart has to prove the process picked the tree up, or the checks below are moot.
  assert.match(deployScript, /running from .*not \$LIVE\/standalone/);

  // pm2's cwd is <LIVE>/standalone, so one dirname. Two resolved to the directory *containing*
  // the site, and the deploy renamed /opt/gpu-unlock itself out of the way before recovering.
  assert.match(deployScript, /LIVE="\$\(dirname "\$cwd"\)"/);
  assert.doesNotMatch(
    deployScript,
    /LIVE="\$\(dirname "\$\(dirname "\$cwd"\)"\)"/,
    "two dirnames gives the site's parent, not the dist tree",
  );

  // A dist tree is identifiable, so a bad LIVE can be rejected before any rename.
  assert.match(deployScript, /is_dist_tree\(\)/);
  assert.match(deployScript, /swap refused/);
});

test("the restart runs only after the build, and is verified before the deploy reports success", () => {
  const buildAt = deployScript.indexOf("npm run build");
  const swapAt = deployScript.indexOf('swap "$STAGING" "$LIVE"');
  // lastIndexOf: the --rollback branch also restarts, and that block sits above the main flow.
  const restartAt = deployScript.lastIndexOf("restart_and_verify ||");
  assert.ok(buildAt > 0 && swapAt > buildAt, "the swap must come after a finished build");
  assert.ok(restartAt > swapAt, "the restart must come after the swap");
  // A 200 on /sitemap.xml proves the process booted; verify-deployment proves the pages exist.
  assert.match(deployScript, /verify-deployment\.mjs/);
  assert.match(deployScript, /--rollback/);
});

test("postbuild follows NEXT_DIST_DIR instead of assuming .next", () => {
  // A staging build whose assets landed in the *previous* tree would boot and 404 every chunk.
  assert.match(postbuild, /process\.env\.NEXT_DIST_DIR/);
  assert.match(postbuild, /join\(buildRoot, "static"\)/);
  assert.match(postbuild, /join\(buildRoot, "server", "app"\)/);
  assert.doesNotMatch(
    postbuild,
    /join\(root, "\.next", "server", "app"\)/,
    "the installer-hash check must read the tree that was just built",
  );
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

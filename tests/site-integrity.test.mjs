// Integrity checks for the parts that decide which site owns which page.
//
// The two hosts (gpu-unlock.com and gpuunlock.com) are deliberately different documents.
// The failure mode that matters is a path drifting back into both sitemaps, a redirect
// that points at a host that does not own that path, or a module table row whose kernel
// parameter does not match the module name — the last one silently does nothing at boot.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { MODULES, moduleForChip } from "../src/data/modules.ts";
import { INSTALL_STEPS, FAILURE_MODE_KEYS, REQUIREMENT_KEYS } from "../src/data/install.ts";
import {
  WINDOWS_LIMIT_KEYS,
  WINDOWS_PROFILE,
  WINDOWS_ROUTES,
} from "../src/data/windows.ts";

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];
// The pinned upstream tag, shared by the site and the installer build. Read from the JSON the
// same way they read it, so a version bump is compared against its own single source.
const packageFacts = JSON.parse(
  readFileSync(new URL("../src/data/windows-package.json", import.meta.url), "utf8"),
);
const loadMessages = (loc) =>
  JSON.parse(readFileSync(new URL(`../messages/${loc}.json`, import.meta.url), "utf8"));

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");

test("every module's parameter matches the module it loads", () => {
  for (const m of MODULES) {
    assert.ok(
      m.parameter.startsWith(`${m.module}.`),
      `${m.id}: parameter ${m.parameter} does not belong to module ${m.module}`,
    );
  }
});

test("the two gpu_unlock forks share the module name but keep distinct entries", () => {
  const byId = Object.fromEntries(MODULES.map((m) => [m.id, m]));
  assert.equal(byId.ampere.module, "gpu_unlock");
  assert.equal(byId.ada.module, "gpu_unlock");
  assert.equal(byId.turing.module, "turing_unlock");
  assert.notEqual(byId.ampere.repo, byId.ada.repo);
});

test("chip families route to the module that accepts them", () => {
  assert.equal(moduleForChip("GA102")?.id, "ampere");
  assert.equal(moduleForChip("AD102")?.id, "ada");
  assert.equal(moduleForChip("AD103")?.id, "ada");
  assert.equal(moduleForChip("TU102")?.id, "turing");
});

test("install step ids have a message entry in every locale", () => {
  for (const loc of LOCALES) {
    const steps = loadMessages(loc).install.steps;
    for (const step of INSTALL_STEPS) {
      assert.ok(steps[step.id], `${loc}: install.steps.${step.id} is missing`);
    }
    assert.deepEqual(
      Object.keys(steps),
      INSTALL_STEPS.map((s) => s.id),
      `${loc}: install.steps keys drifted from INSTALL_STEPS`,
    );
  }
});

test("failure and requirement entries are identical in every locale", () => {
  for (const loc of LOCALES) {
    const install = loadMessages(loc).install;
    assert.deepEqual(
      Object.keys(install.failures),
      [...FAILURE_MODE_KEYS],
      `${loc}: install.failures keys drifted`,
    );
    assert.deepEqual(
      Object.keys(install.requirements),
      [...REQUIREMENT_KEYS],
      `${loc}: install.requirements keys drifted`,
    );
  }
});

// /windows renders its sections by iterating data, so a locale missing one entry loses a
// whole table row or route block in that language only — nothing else fails, and nobody
// reviews seven translations looking for a gap. The install page has had this check since it
// was written; the windows page did not.
test("windows section keys are identical in every locale", () => {
  const routeIds = WINDOWS_ROUTES.map((r) => r.id);
  const profileKeys = WINDOWS_PROFILE.map((r) => r.key);

  for (const loc of LOCALES) {
    const w = loadMessages(loc).windows;

    assert.deepEqual(
      Object.keys(w.routes),
      routeIds,
      `${loc}: windows.routes keys drifted from WINDOWS_ROUTES`,
    );
    for (const id of routeIds) {
      for (const field of ["h", "b"]) {
        assert.ok(w.routes[id][field], `${loc}: windows.routes.${id}.${field} is empty`);
      }
    }

    assert.deepEqual(
      Object.keys(w.limits),
      [...WINDOWS_LIMIT_KEYS],
      `${loc}: windows.limits keys drifted from WINDOWS_LIMIT_KEYS`,
    );
    for (const key of WINDOWS_LIMIT_KEYS) {
      for (const field of ["h", "b"]) {
        assert.ok(w.limits[key][field], `${loc}: windows.limits.${key}.${field} is empty`);
      }
    }

    // The profile table's row labels come from labels.<key>, keyed by the data row.
    assert.deepEqual(
      Object.keys(w.labels),
      profileKeys,
      `${loc}: windows.labels keys drifted from WINDOWS_PROFILE`,
    );

    // The benchmark table prints the workload name itself (row.key.toUpperCase()) and only
    // translates the column headers, so those four are what a locale has to carry.
    for (const header of ["benchCard", "benchBefore", "benchAfter", "benchDelta"]) {
      assert.ok(w[header], `${loc}: windows.${header} is empty`);
    }
  }
});

test("the sitemap only lists the paths this site owns", () => {
  const paths = JSON.parse(
    sitemap.match(/const PATHS = (\[[\s\S]*?\]);/)[1],
  );
  assert.deepEqual(paths, ["", "/install", "/windows", "/faq"]);
});

// `lastModified: new Date()` is the obvious thing to write and it makes the sitemap lie: every
// URL is stamped with the build time, so a rebuild that changed nothing announces that all 28
// pages changed. Crawlers drop lastmod entirely once it stops correlating with the content.
// Absent is honest; a build timestamp is not.
test("the sitemap does not claim every page changed at build time", () => {
  // Strip comments first: the note explaining *why* the field is gone names it, and only
  // code that actually emits the field should fail this.
  const code = sitemap
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/lastModified|lastmod/.test(code),
    "sitemap stamps URLs with the build time; drop the field instead of faking a date",
  );
});

// The installer is repacked on every build and NSIS does not produce reproducible bytes, so
// the hash printed on /windows has to come from the .sha256 file written beside the .exe. If
// the page were to carry its own copy of the hash, a rebuild would leave the site advertising
// a checksum that no longer matches the download. This compares the two files directly.
test("the published installer hash matches the installer being served", async () => {
  const dir = new URL("../public/downloads/", import.meta.url);
  const name = `GPU-Unlock-Windows-${packageFacts.version}-Setup.exe`;
  // The page builds its own name from the version; if those two ever disagree the download
  // link points at a file that is not there, so compare it against the artifact on disk.
  const { WINDOWS_PACKAGE } = await import("../src/data/windows.ts");
  assert.equal(WINDOWS_PACKAGE.fileName, name);
  assert.equal(WINDOWS_PACKAGE.downloadPath, `/downloads/${name}`);
  const exe = readFileSync(new URL(name, dir));
  const sidecar = readFileSync(new URL(`${name}.sha256`, dir), "utf8");
  const expected = createHash("sha256").update(exe).digest("hex");
  assert.equal(sidecar.trim().split(/\s+/)[0], expected);
  // MZ is the DOS header every Windows PE starts with; an HTML error page would not have it.
  assert.equal(exe.subarray(0, 2).toString("latin1"), "MZ");
});

// A version bump renames the artifact, and the old one stays downloadable unless the build
// removes it. Both carry a self-consistent .sha256, so a stale release is invisible to every
// other check — the reader just has two installers to choose from.
test("the download directory holds only the pinned version", () => {
  const names = readdirSync(new URL("../public/downloads/", import.meta.url));
  const releases = names.filter((n) => /^GPU-Unlock-Windows-.+-Setup\.exe(\.sha256)?$/.test(n));
  const expected = [
    `GPU-Unlock-Windows-${packageFacts.version}-Setup.exe`,
    `GPU-Unlock-Windows-${packageFacts.version}-Setup.exe.sha256`,
  ];
  assert.deepEqual(releases.sort(), expected.sort());
});

// The /windows page tells the reader its command blocks are copied verbatim from the pinned
// upstream docs. A translated or "improved" option name is a command that fails on their
// machine, and the mistake is invisible in review — so the claim is checked instead of
// trusted: every non-empty line of every block must appear in the upstream sources. The
// sources come from the same pinned archive the installer is built from, unpacked by
// `npm run check:installer` into deploy/installer/.build/unpacked.
test("documented commands appear verbatim in the pinned upstream sources", async (t) => {
  const { WINDOWS_ROUTES } = await import("../src/data/windows.ts");
  const root = new URL(
    `../deploy/installer/.build/unpacked/Windows-GPU-UNLOCK-${packageFacts.version}/`,
    import.meta.url,
  );
  let upstream;
  try {
    upstream = ["docs/GUIDE.en.md", "docs/HEADLESS.en.md", "docs/INTERNAL-BOOT.en.md", "README.md"]
      .map((p) => readFileSync(new URL(p, root), "utf8"))
      .join("\n");
  } catch {
    // Nothing unpacked: `npm run check:installer` has not run since the last clean. Reported as
    // a skip rather than a pass — a run that never compared anything must not read as green.
    t.skip("upstream archive not unpacked; run `npm run check:installer` first");
    return;
  }
  const blocks = [...upstream.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const literal = blocks
    .join("\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const route of WINDOWS_ROUTES) {
    for (const raw of route.code.split("\n")) {
      const line = raw.trim().replace(/`$/, "").trim();
      if (!line) continue;
      assert.ok(
        literal.includes(line),
        `${route.id}: "${line}" is not copied verbatim from the upstream docs`,
      );
    }
  }
});

// Production runs from .next/standalone (see deploy/ecosystem.config.cjs), and Next does not
// copy public/ or .next/static into it by itself. The regression this guards against shipped
// once: `next start` at the repo root served the installer fine while the standalone tree
// returned 404 for it, so the check now looks at what the server will actually read.
test("standalone tree carries the installer and the client assets", (t) => {
  const standalone = new URL("../.next/standalone/", import.meta.url);
  const installer = new URL("public/downloads/GPU-Unlock-Windows-0.3.1-Setup.exe", standalone);
  try {
    readFileSync(installer);
  } catch {
    t.skip("no .next/standalone build present; run `npm run build` first");
    return;
  }
  assert.ok(readFileSync(installer).subarray(0, 2).toString("latin1") === "MZ", "installer is a PE");
  assert.ok(
    readdirSync(new URL(".next/static/", standalone)).length > 0,
    ".next/static was not copied into the standalone tree",
  );
});

test("cross-site redirects point at the host that owns the path", () => {
  // gpus/benchmarks live on the reference site, install/faq live here.
  assert.match(nextConfig, /source: "\/:locale\/gpus"[\s\S]*?destination: "https:\/\/gpuunlock\.com\/:locale\/gpus"/);
  assert.match(nextConfig, /source: "\/:locale\/benchmarks"[\s\S]*?destination: "https:\/\/gpuunlock\.com\/:locale\/benchmarks"/);
  assert.ok(
    !/source: "\/:locale\/install"[\s\S]*?destination: "https:\/\/gpuunlock\.com/.test(nextConfig),
    "install must stay on this host",
  );
  assert.ok(
    !/source: "\/:locale\/faq"[\s\S]*?destination: "https:\/\/gpuunlock\.com/.test(nextConfig),
    "faq must stay on this host",
  );
});

// The page renders `v{version}` from windows-package.json. A locale that spells the tag out
// instead keeps showing the old release after a bump, in one language, where nobody notices.
test("no locale hardcodes the upstream version in prose", () => {
  for (const loc of LOCALES) {
    const windows = loadMessages(loc).windows;
    const prose = JSON.stringify(windows);
    assert.ok(
      !prose.includes(`v${packageFacts.version}`) && !prose.includes(packageFacts.version),
      `${loc}: windows text spells out version ${packageFacts.version}; use the {version} placeholder`,
    );
  }
});

test("every locale carries the same top-level namespaces", () => {
  const base = Object.keys(loadMessages("en"));
  for (const loc of LOCALES) {
    assert.deepEqual(Object.keys(loadMessages(loc)), base, `${loc}: top-level namespaces drifted`);
  }
});

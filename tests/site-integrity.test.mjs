// Integrity checks for the parts that decide which site owns which page.
//
// The two hosts (gpu-unlock.com and gpuunlock.com) are deliberately different documents.
// The failure mode that matters is a path drifting back into both sitemaps, a redirect
// that points at a host that does not own that path, or a module table row whose kernel
// parameter does not match the module name — the last one silently does nothing at boot.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MODULES, moduleForChip } from "../src/data/modules.ts";
import { INSTALL_STEPS, FAILURE_MODE_KEYS, REQUIREMENT_KEYS } from "../src/data/install.ts";

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];
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

test("the sitemap only lists the paths this site owns", () => {
  const paths = JSON.parse(
    sitemap.match(/const PATHS = (\[[\s\S]*?\]);/)[1],
  );
  assert.deepEqual(paths, ["", "/install", "/faq"]);
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

test("every locale carries the same top-level namespaces", () => {
  const base = Object.keys(loadMessages("en"));
  for (const loc of LOCALES) {
    assert.deepEqual(Object.keys(loadMessages(loc)), base, `${loc}: top-level namespaces drifted`);
  }
});

// Integrity checks for the parts that decide which site owns which page.
//
// The two hosts (gpu-unlock.com and gpuunlock.com) are deliberately different documents.
// The failure mode that matters is a path drifting back into both sitemaps, a redirect
// that points at a host that does not own that path, or a module table row whose kernel
// parameter does not match the module name — the last one silently does nothing at boot.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

test("the sitemap lists every hub this site serves", () => {
  // A hub that ships without a sitemap entry is a page crawlers find only by accident.
  const paths = JSON.parse(
    sitemap.match(/const PATHS = (\[[\s\S]*?\]);/)[1],
  );
  assert.deepEqual(paths, [
    "",
    "/install",
    "/windows",
    "/gpus",
    "/chips",
    "/benchmarks",
    "/answers",
    "/use-cases",
    "/faq",
    "/about",
    "/changelog",
  ]);
});

// Detail pages are generated from the data they render. Hardcoding them in the sitemap would
// mean the day a card or a mode is added, its page exists but no crawler is told about it.
test("the sitemap derives every detail page from its data", () => {
  const derived = [...sitemap.matchAll(/const (\w+_PATHS) = /g)].map((m) => m[1]);
  assert.deepEqual(derived.sort(), [
    "ANSWER_PATHS",
    "CARD_PATHS",
    "CHIP_PATHS",
    "MODE_PATHS",
    "USE_CASE_PATHS",
  ]);

  // Each derived array must actually reach the emitted list. A defined-but-unused array is the
  // failure mode this guards: it reads as wired up and produces no URL.
  const emitted = sitemap.match(/\[\.\.\.PATHS, ([^\]]+)\]/)?.[1] ?? "";
  for (const name of derived) {
    assert.ok(emitted.includes(`...${name}`), `${name} is not spread into the sitemap`);
  }
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
  // All content paths are served here. A redirect for one of them would mean the route files
  // still build pages that no request can reach, and crawlers would index a redirect instead.
  for (const page of ["gpus", "benchmarks", "install", "faq", "windows"]) {
    assert.ok(
      !new RegExp(`source: "/:locale/${page}"[\\s\\S]*?destination: "https://gpuunlock\\.com`).test(
        nextConfig,
      ),
      `${page} must stay on this host`,
    );
  }
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

// A message key that does not exist does not throw: next-intl renders the key itself, so the
// page ships the literal text "modePage.byModeTitle" to readers. This happened on /benchmarks
// and no test caught it, because the build, lint and every HTTP status were green.
//
// This walks every page instead of one hand-listed file, because the failure is not specific
// to /benchmarks. It reads each file's own `getTranslations` binding, so a page that renames
// its helper or switches namespace is still covered without editing this test.

/** Every .tsx file under src/app, as URLs. */
function pageFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) out.push(...pageFiles(child));
    else if (entry.name.endsWith(".tsx")) out.push(child);
  }
  return out;
}

/** `const t = await getTranslations("ns")` and the `{ locale, namespace: "ns" }` form. */
function bindingsIn(source) {
  const found = new Map();
  const re =
    /const\s+(\w+)\s*=\s*await\s+getTranslations\(\s*(?:\{[^}]*namespace:\s*"([\w]+)"[^}]*\}|"([\w]+)")\s*\)/g;
  for (const m of source.matchAll(re)) {
    found.set(m[1], m[2] ?? m[3]);
  }
  return found;
}

/** Literal keys and template keys, as `t("x")`, `t.rich("x")`, `t(`x.${y}`)`. */
function callsIn(source, fn) {
  const callee = `${fn}(?:\\.(?:rich|raw|markup))?`;
  const literal = [...source.matchAll(new RegExp(`\\b${callee}\\(\\s*"([\\w.]+)"`, "g"))].map(
    (m) => ({ kind: "literal", key: m[1] }),
  );
  const template = [...source.matchAll(new RegExp(`\\b${callee}\\(\\s*\`([^\`]+)\``, "g"))].map(
    (m) => {
      // Two shapes, and they need different rules:
      //   `modules.${m.summaryKey}` — static part ends with a dot: a nested lookup, so
      //                               "modules" must be an object.
      //   `q${i + 1}`               — no dot: a bare stem, satisfied by any key starting with it.
      // Collapsing both into "prefix" and then allowing startsWith for the nested shape is what
      // made deleting `windows.routes` pass, because `routesTitle` also starts with "routes".
      const staticPart = m[1].split("${")[0];
      const nested = staticPart.endsWith(".");
      return { kind: "template", prefix: staticPart.replace(/\.$/, ""), nested };
    },
  );
  return [...literal, ...template];
}

test("every key a page asks for exists in every locale", () => {
  const pages = pageFiles(new URL("../src/app/", import.meta.url));
  assert.ok(pages.length >= 8, `expected the site's pages, found ${pages.length}`);

  const locales = LOCALES.map((loc) => ({ loc, messages: loadMessages(loc) }));
  let checked = 0;

  for (const file of pages) {
    const source = readFileSync(file, "utf8");
    const bindings = bindingsIn(source);
    const where = file.pathname.split("/src/app/")[1];

    for (const [fn, ns] of bindings) {
      for (const { kind, key, prefix, nested } of callsIn(source, fn)) {
        for (const { loc, messages } of locales) {
          const table = messages[ns];
          assert.ok(table, `${loc}: ${where} uses namespace "${ns}", which does not exist`);

          if (kind === "literal") {
            assert.ok(
              Object.hasOwn(table, key),
              `${loc}: ${where} calls ${fn}("${key}") but ${ns}.${key} is missing`,
            );
            checked += 1;
            continue;
          }

          // A template key cannot be checked exactly without running the page, but its static
          // part can.
          if (prefix === "") continue;

          // Nested: walk the dotted path and stop at the leaf object. Falling back to a
          // prefix match here would accept `routesTitle` for a missing `routes`.
          const segments = prefix.split(".");
          let node = table;
          for (const segment of segments) {
            node = node && Object.hasOwn(node, segment) ? node[segment] : undefined;
          }
          const found = nested
            ? node !== undefined
            : Object.keys(table).some((k) => k.startsWith(prefix));
          assert.ok(
            found,
            nested
              ? `${loc}: ${where} builds keys from "${prefix}.…" but ${ns}.${prefix} is missing`
              : `${loc}: ${where} builds keys from "${prefix}", which ${ns} has no entries for`,
          );
          checked += 1;
        }
      }
    }
  }

  assert.ok(checked > 200, `only ${checked} key checks ran; the parser probably missed the pages`);
});

// Existence is not enough. next-intl takes the values it is handed and interpolates only the
// placeholders the message actually names; anything else is dropped without a warning. The
// reverse case is louder but equally silent at build time: a {placeholder} the call never
// supplies ships to readers as the literal braces. Both happened while re-translating
// modePage.resultBody, and every build, lint and HTTP status stayed green.

// Scanning JS with a character loop has to know about strings and comments, or the separators
// inside them are read as structure. A line comment holding a comma silently dropped every
// argument after it, which turns a missing-placeholder failure into a pass — the failure mode
// this whole test exists to prevent.
//
// `mask()` blanks out string, template and comment contents while keeping length and newlines,
// so index arithmetic still lines up with the original source.

/** Replace the contents of strings, templates and comments with spaces. */
function mask(source) {
  const out = source.split("");
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      // Keep the delimiters; blank the body. Template interpolations `${…}` are blanked too,
      // which is what we want: their contents are not object keys.
      let k = i + 1;
      while (k < source.length) {
        if (source[k] === "\\") k += 2;
        else if (source[k] === ch) break;
        else k += 1;
      }
      blank(i + 1, k);
      i = k + 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/** Argument names of a `{ ... }` object literal starting at `open`, respecting nesting. */
function objectKeys(source, open) {
  const masked = mask(source);

  let depth = 0;
  let close = -1;
  for (let i = open; i < masked.length; i += 1) {
    const ch = masked[i];
    if (ch === "{" || ch === "(" || ch === "[") depth += 1;
    else if (ch === "}" || ch === ")" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return null;

  // Split the body on top-level commas, then keep `name:` prefixes. Computed or spread
  // entries are not names, so they are skipped rather than guessed at. Values are read from
  // the masked copy so a comma inside a string cannot split an entry; names come from the
  // original, where they are not blanked.
  const body = masked.slice(open + 1, close);
  const keys = [];
  let depth2 = 0;
  let start = 0;
  for (let i = 0; i <= body.length; i += 1) {
    const ch = body[i];
    if (ch === "{" || ch === "(" || ch === "[") depth2 += 1;
    else if (ch === "}" || ch === ")" || ch === "]") depth2 -= 1;
    if ((ch === "," && depth2 === 0) || i === body.length) {
      // Read the name from the masked copy. Identifiers survive masking; comments and string
      // bodies do not, so a segment that starts with a comment still exposes its own key.
      const part = body.slice(start, i).trim();
      // `cards: expr` and the shorthand `cards` both pass an argument named cards.
      const name = part.match(/^(\w+)\s*:/) ?? part.match(/^(\w+)$/);
      if (name) keys.push(name[1]);
      start = i + 1;
    }
  }
  return keys;
}

/** Every `t("key", {...})` call, with the key and the names it passes. */
function callsWithArgs(source, fn) {
  const re = new RegExp(`\\b${fn}\\(\\s*"([\\w.]+)"\\s*(,|\\s*\\))`, "g");
  const out = [];
  for (const m of source.matchAll(re)) {
    if (m[2] === ")" || !m[2]) {
      out.push({ key: m[1], args: [] });
      continue;
    }
    const open = source.indexOf("{", m.index + m[0].length - 1);
    const args = open >= 0 ? objectKeys(source, open) : null;
    out.push({ key: m[1], args: args ?? [] });
  }
  return out;
}

test("every translation call passes exactly the placeholders its message names", () => {
  const pages = pageFiles(new URL("../src/app/", import.meta.url));
  const locales = LOCALES.map((loc) => ({ loc, messages: loadMessages(loc) }));
  let checked = 0;

  for (const file of pages) {
    const source = readFileSync(file, "utf8");
    const where = file.pathname.split("/src/app/")[1];

    for (const [fn, ns] of bindingsIn(source)) {
      for (const { key, args } of callsWithArgs(source, fn)) {
        for (const { loc, messages } of locales) {
          const found = findMessage(messages, ns, key);
          // Missing keys are the other test's job; skip so one failure is not reported twice.
          if (found === undefined) continue;

          const named = new Set([...found.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
          const passed = new Set(args);

          for (const name of named) {
            assert.ok(
              passed.has(name),
              `${loc}: ${where} calls ${fn}("${key}") without {${name}}, so it renders as literal text`,
            );
          }
          for (const name of passed) {
            assert.ok(
              named.has(name),
              `${loc}: ${where} passes {${name}} to ${fn}("${key}") but the message never uses it`,
            );
          }
          checked += 1;
        }
      }
    }
  }

  assert.ok(checked > 20, `only ${checked} placeholder checks ran`);
});

// The scanner above is the test's own weak point: if it mis-splits an argument list, it reports
// fewer arguments than the page passes and the placeholder check quietly passes. These cases
// are the ones a character loop gets wrong without knowing about strings and comments.
test("the argument scanner survives strings, templates and comments", () => {
  const cases = [
    ["{ a: 1, b: 2 }", ["a", "b"]],
    ["{ cards }", ["cards"]],
    ['{ label: "hello, world", n: 1 }', ["label", "n"]],
    ["{ a: 1, // note, still comment\n b: 2 }", ["a", "b"]],
    ["{ a: 1, /* x, y */ b: 2 }", ["a", "b"]],
    ['{ a: "q\\", r", b: 2 }', ["a", "b"]],
    ["{ a: `t, ${x, y}`, b: 2 }", ["a", "b"]],
    [
      "{ mode: group.name, count: rows.length, cards: new Set(rows.map((r) => r.cardSlug)).size }",
      ["mode", "count", "cards"],
    ],
  ];
  for (const [input, expected] of cases) {
    assert.deepEqual(objectKeys(input, 0), expected, `scanner split ${input} incorrectly`);
  }
});

// src/app/opengraph-image.tsx builds a 1200×630 card. Next only attaches file-based metadata
// to a segment that does not set its own `openGraph`, and every page here sets a title and
// description — so the image was built on every deploy and linked from nowhere, while
// twitter:card still claimed summary_large_image. A crawler saw a large-card declaration with
// no image and fell back to a plain link.
test("social cards point at the generated image", () => {
  const seo = readFileSync(new URL("../src/lib/seo.ts", import.meta.url), "utf8");

  assert.match(seo, /images:\s*\[\{ url: image/, "openGraph is missing the image");
  assert.match(seo, /twitter:[\s\S]{0,200}images:\s*\[image\]/, "twitter is missing the image");
  // The file that builds it must still exist at the path the metadata names.
  assert.ok(
    existsSync(new URL("../src/app/opengraph-image.tsx", import.meta.url)),
    "opengraph-image.tsx was removed but the metadata still points at it",
  );
  assert.match(seo, /"x-default"/, "hreflang has no x-default for readers outside the seven");
});

/** Look a dotted key up inside one namespace, or undefined. */
function findMessage(messages, ns, key) {
  let node = messages[ns];
  for (const segment of key.split(".")) {
    if (!node || !Object.hasOwn(node, segment)) return undefined;
    node = node[segment];
  }
  return typeof node === "string" ? node : undefined;
}

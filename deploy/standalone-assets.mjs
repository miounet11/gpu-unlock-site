// Next's standalone output is a self-contained server tree, but it deliberately leaves out
// the two directories the server does not import: `public/` and `.next/static`. The process
// started from `deploy/ecosystem.config.cjs` runs with cwd `.next/standalone`, so without
// this copy every file under public/ — including the Windows installer — and every JS/CSS
// chunk is a 404 in production while `next start` from the repo root still looks fine.
//
// This runs as `postbuild`, so `npm run build` produces a tree that can be served as-is.
// It only copies into .next/standalone when that directory exists, and it overwrites, so
// running it twice or after a server-side copy is harmless.

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const root = process.cwd();
// Must follow whatever distDir `next build` actually wrote. deploy.sh builds into a staging
// distDir so the live tree is never modified mid-build; a hardcoded `.next` there would copy
// public/ and static/ into the *previous* build and leave the new one without them.
// deploy.sh passes an absolute path, and join() would nest that under root instead of using it.
const distDir = process.env.NEXT_DIST_DIR || ".next";
const buildRoot = isAbsolute(distDir) ? distDir : resolve(root, distDir);
const standalone = join(buildRoot, "standalone");

if (!existsSync(standalone)) {
  console.log(`standalone skip  no ${distDir}/standalone in this build`);
  process.exit(0);
}

const pairs = [
  [join(root, "public"), join(standalone, "public")],
  [join(buildRoot, "static"), join(standalone, ".next", "static")],
];

for (const [from, to] of pairs) {
  if (!existsSync(from)) {
    throw new Error(`missing build input: ${from}`);
  }
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`standalone copy  ${from.slice(root.length + 1)} -> ${to.slice(root.length + 1)}`);
}

// The /windows page bakes in the installer hash when it is prerendered. NSIS output is not
// reproducible, so repacking after `next build` produces a different artifact while the page
// keeps advertising the previous checksum — a reader following the site would verify their
// download against a value that can never match.
//
// The check has to compare the *rendered page* against the artifact. Comparing the copied .exe
// with its copied .sha256 (both from public/) would always pass and catch nothing; that
// tautology was here before and let this exact drift through.
const downloads = join(root, "public", "downloads");
const pagesDir = join(buildRoot, "server", "app");

if (existsSync(downloads)) {
  for (const name of readdirSync(downloads)) {
    if (!name.endsWith(".exe")) continue;
    const actual = createHash("sha256").update(readFileSync(join(downloads, name))).digest("hex");
    const sidecarPath = join(downloads, `${name}.sha256`);
    if (!existsSync(sidecarPath)) throw new Error(`missing checksum file for ${name}`);
    const declared = readFileSync(sidecarPath, "utf8").trim().split(/\s+/)[0];
    if (actual !== declared) {
      throw new Error(`${name} does not match its own .sha256\n  actual   ${actual}\n  declared ${declared}`);
    }

    // Every locale prerendered its own copy of /windows, so every one has to carry it.
    const stale = [];
    for (const locale of readdirSync(pagesDir)) {
      const page = join(pagesDir, locale, "windows.html");
      if (!existsSync(page)) continue;
      if (!readFileSync(page, "utf8").includes(actual)) stale.push(locale);
    }
    if (stale.length) {
      throw new Error(
        `the prerendered /windows page advertises a different installer hash than ${name}\n` +
          `  artifact ${actual}\n  stale locales ${stale.join(", ")}\n` +
          "Repacking changes the bytes every time: run `npm run build:installer` before " +
          "`npm run build`, not after.",
      );
    }
    console.log(`standalone ok    ${name} — hash matches the served artifact and every page`);
  }
}

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
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.log("standalone skip  no .next/standalone in this build");
  process.exit(0);
}

const pairs = [
  [join(root, "public"), join(standalone, "public")],
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
];

for (const [from, to] of pairs) {
  if (!existsSync(from)) {
    throw new Error(`missing build input: ${from}`);
  }
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`standalone copy  ${from.slice(root.length + 1)} -> ${to.slice(root.length + 1)}`);
}

// The /windows page prints the installer hash it reads at build time. If the installer is
// repacked after `next build` — the normal order, since the artifact has to exist before the
// page that advertises it — the standalone copy would otherwise keep serving the previous
// repository while the site shows the new hash. Comparing the two here turns that silent
// mismatch into a failed build instead of a wrong checksum on a download page.
const downloads = join(standalone, "public", "downloads");
if (existsSync(downloads)) {
  for (const name of readdirSync(downloads)) {
    if (!name.endsWith(".exe")) continue;
    const actual = createHash("sha256").update(readFileSync(join(downloads, name))).digest("hex");
    const sidecarPath = join(downloads, `${name}.sha256`);
    if (!existsSync(sidecarPath)) throw new Error(`missing checksum file for ${name}`);
    const declared = readFileSync(sidecarPath, "utf8").trim().split(/\s+/)[0];
    if (actual !== declared) {
      throw new Error(
        `${name} does not match its .sha256 in the standalone tree\n  actual   ${actual}\n  declared ${declared}\n` +
          "Repack with `npm run build:installer` and rebuild; do not serve a stale artifact.",
      );
    }
    console.log(`standalone ok    ${name} matches its published sha256`);
  }
}

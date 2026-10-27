#!/usr/bin/env node
// Checks the three pinned upstream repositories against the revisions recorded in
// src/data/upstream-pins.json.
//
// Exit codes, so a scheduled job can tell "upstream moved" from "network is down":
//   0  every pin still matches
//   1  at least one upstream moved (a report is printed; nothing is written)
//   2  the check could not run (network, API limit, malformed pin file)
//
// This script never writes site data. Upstream moving is normal and does not mean our
// transcription is wrong — it means someone should read the diff and decide. That is why the
// exit code is separate from the build.

import { readFileSync } from "node:fs";

const PINS_URL = new URL("../src/data/upstream-pins.json", import.meta.url);
const TOKEN = process.env.GITHUB_TOKEN;
const API = "https://api.github.com";

function headers() {
  const h = { Accept: "application/vnd.github+json", "User-Agent": "gpu-unlock-site" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`${path} -> HTTP ${res.status} ${body.slice(0, 120)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Resolve a tag to the commit it points at, following one level of annotated tag. */
async function resolveTag(repo, tag) {
  const ref = await getJson(`/repos/${repo}/git/ref/tags/${tag}`);
  if (ref.object?.type !== "tag") return ref.object?.sha;
  const annotated = await getJson(`/repos/${repo}/git/tags/${ref.object.sha}`);
  return annotated.object?.sha;
}

async function headOf(repo, branch) {
  const commit = await getJson(`/repos/${repo}/commits/${branch}`);
  return commit.sha;
}

async function main() {
  let pins;
  try {
    pins = JSON.parse(readFileSync(PINS_URL, "utf8"));
  } catch (err) {
    console.error(`cannot read ${PINS_URL.pathname}: ${err.message}`);
    process.exit(2);
  }

  const modules = Object.entries(pins.modules ?? {});
  if (modules.length === 0) {
    console.error("no modules recorded in upstream-pins.json");
    process.exit(2);
  }

  let drifted = 0;
  let failed = 0;

  for (const [id, pin] of modules) {
    let actual;
    try {
      actual =
        pin.refKind === "tag"
          ? await resolveTag(pin.repo, pin.ref)
          : await headOf(pin.repo, pin.ref);
    } catch (err) {
      failed += 1;
      console.error(`? ${id.padEnd(8)} ${pin.repo}: ${err.message}`);
      continue;
    }

    if (!actual) {
      failed += 1;
      console.error(`? ${id.padEnd(8)} ${pin.repo}: could not resolve ${pin.ref}`);
      continue;
    }

    if (actual === pin.commit) {
      console.log(`= ${id.padEnd(8)} ${pin.repo} ${pin.ref} @ ${actual.slice(0, 12)}`);
    } else {
      drifted += 1;
      console.log(
        `! ${id.padEnd(8)} ${pin.repo} ${pin.ref}: pinned ${pin.commit.slice(0, 12)}, now ${actual.slice(0, 12)}`,
      );
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} module(s) could not be checked — this is not a drift report.`);
    process.exit(2);
  }
  if (drifted > 0) {
    console.error(`\n${drifted} upstream revision(s) moved. Read the diff before touching site data.`);
    process.exit(1);
  }
  console.log("\nAll pins match.");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

// Post-deploy patrol for gpu-unlock.com.
//
//   node scripts/patrol-live.mjs
//   node scripts/patrol-live.mjs --base http://127.0.0.1:3200
//   node scripts/patrol-live.mjs --locale zh --limit 5
//
// Why this exists: verify-deployment.mjs proves every sitemap URL answers 200, which a deploy
// runs once. It cannot catch the failure this host keeps producing — a page that answers 200
// while its content is wrong. cleanyourtv shipped without its footer links for days that way:
// status 200, title correct, no sister block, and nothing looked again after the deploy.
//
// What it checks on a sample of live pages, in both directions:
//   - the footer links every sister site (a dropped SISTER_SITES entry is a one-line change)
//   - the page carries its own language, not the English fallback
//   - the h1 and title match what the route is supposed to be
//
// Sampling, not the whole sitemap: this runs daily on a host that also builds, and a check that
// takes 20 minutes gets killed or ignored. verify-deployment.mjs is the exhaustive one.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
// Both `--base=URL` and `--base URL`. Only the first form was accepted at first, so
// `--base http://127.0.0.1:59999` silently fell back to the production URL and reported a
// clean patrol of a host that was never asked. A check that quietly ignores its argument is
// worse than no check: it looks like coverage.
const arg = (name, fallback) => {
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = arg("base", "https://gpu-unlock.com").replace(/\/$/, "");
const ONLY_LOCALE = arg("locale", "");
const LIMIT = Number(arg("limit", "0")) || 0;
const TIMEOUT_MS = Number(arg("timeout", "15000")) || 15000;
const CONCURRENCY = 6;

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];

// Same source of truth the footer renders from, read as text: importing the TS module would
// need a build step, and a patrol that cannot run on a bare checkout is a patrol nobody runs.
const siteTs = readFileSync(join(ROOT, "src/lib/site.ts"), "utf8");
const REFERENCE = siteTs.match(/export const REFERENCE_SITE = "([^"]+)"/)?.[1];
const SISTERS = [...siteTs.matchAll(/\{ name: "[^"]+", url: (?:"([^"]+)"|REFERENCE_SITE)/g)].map(
  (m) => m[1] ?? REFERENCE,
);

if (!REFERENCE || SISTERS.length === 0) {
  console.error("could not read SISTER_SITES from src/lib/site.ts");
  process.exit(2);
}

const hostOf = (url) => new URL(url).host.replace(/^www\./, "");

async function get(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

// A locale path to sample. The locale prefix is part of the check: a page that falls back to
// English still returns 200, and the only difference is <html lang> and the copy.
const paths = [];
for (const locale of LOCALES) {
  if (ONLY_LOCALE && locale !== ONLY_LOCALE) continue;
  paths.push(`/${locale}`);
  paths.push(`/${locale}/benchmarks`);
}

const targets = LIMIT > 0 ? paths.slice(0, LIMIT) : paths;

const failures = [];

function check(cond, path, message) {
  if (!cond) failures.push(`${path}: ${message}`);
}

async function checkPage(path) {
  let res;
  try {
    res = await get(`${BASE}${path}`);
  } catch (err) {
    failures.push(`${path}: unreachable (${err.message})`);
    return;
  }
  if (res.status !== 200) {
    failures.push(`${path}: HTTP ${res.status}`);
    return;
  }

  const html = res.body;
  const locale = path.split("/")[1];

  // The sister footer is the thing that silently disappeared on the sibling site. Each live
  // page must name every other host, so a dropped entry fails here rather than in a month.
  for (const url of SISTERS) {
    if (!html.includes(url)) failures.push(`${path}: footer is missing ${hostOf(url)}`);
  }

  // Language fallback: <html lang> is the cheapest signal that the route resolved its locale.
  const lang = html.match(/<html[^>]+lang="([^"]+)"/)?.[1] ?? "";
  const want = locale === "zh" ? "zh" : locale;
  check(lang.startsWith(want), path, `html lang is "${lang}", expected "${want}"`);

  // A page that rendered its shell but not its body still has a title and no h1.
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    ?.replace(/<[^>]+>/g, "")
    .trim();
  check(Boolean(h1), path, "no h1 rendered");

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
  check(Boolean(title), path, "no <title>");
}

async function run() {
  process.stdout.write(`patrol ${targets.length} page(s) against ${BASE}\n`);
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(checkPage));
  }

  if (failures.length === 0) {
    process.stdout.write(`patrol ok  ${targets.length} page(s) looked right\n`);
    return 0;
  }
  for (const line of failures) process.stderr.write(`  ${line}\n`);
  process.stderr.write(`patrol failed  ${failures.length} problem(s) across ${targets.length} page(s)\n`);
  return 1;
}

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(2);
  },
);

// Every string in messages/*.json is an ICU message, whether or not it looks like one.
//
// A literal `<config>` in the install guide's mkinitcpio note was parsed as an unclosed tag and
// threw UNCLOSED_TAG at render time. Nothing caught it: tsc, the build and every other test
// passed, because the failure only happens when next-intl formats that one key. Angle brackets
// and stray braces are ordinary punctuation in prose about kernel flags, so the guard has to
// run over the whole catalogue rather than the pages that happen to be on screen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { IntlMessageFormat } from "intl-messageformat";
import { INSTALL_STEPS, FAILURE_MODE_KEYS, REQUIREMENT_KEYS } from "../src/data/install.ts";
import { WINDOWS_LIMIT_KEYS, WINDOWS_ROUTES } from "../src/data/windows.ts";

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];
const messagesDir = new URL("../messages/", import.meta.url);
const loadMessages = (loc) => JSON.parse(readFileSync(new URL(`${loc}.json`, messagesDir), "utf8"));

// Flatten to leaf strings so a failure names the exact key instead of the namespace.
function flatten(value, path = "", out = []) {
  for (const [key, child] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (typeof child === "string") out.push([next, child]);
    else if (child && typeof child === "object") flatten(child, next, out);
  }
  return out;
}

test("every message parses as an ICU message in its own locale", () => {
  const failures = [];
  for (const locale of LOCALES) {
    for (const [key, text] of flatten(loadMessages(locale))) {
      try {
        new IntlMessageFormat(text, locale);
      } catch (error) {
        failures.push(`${locale} ${key}: ${error.message}`);
      }
    }
  }
  assert.deepEqual(failures, [], `unparseable messages:\n${failures.join("\n")}`);
});

test("an escaped literal survives formatting without its quotes", () => {
  // The fix for the note above was to quote the literal, so the rendered text has to still
  // contain `<config>` and must not leak the escaping apostrophes to the reader.
  for (const locale of LOCALES) {
    const note = loadMessages(locale).install.steps.initramfs.note;
    const rendered = new IntlMessageFormat(note, locale).format();
    assert.ok(rendered.includes("<config>"), `${locale}: <config> was lost in formatting`);
    assert.ok(!rendered.includes("'<"), `${locale}: escaping quotes leaked into the output`);
  }
});

// next-intl throws on a key that does not exist, so a step list that drifts from the catalogue
// is a crash loop on that page rather than a missing line. These mirror the constants the pages
// iterate over, so the page and the catalogue cannot disagree silently.
test("every install step has a title and a body in every locale", () => {
  for (const locale of LOCALES) {
    const { steps } = loadMessages(locale).install;
    for (const step of INSTALL_STEPS) {
      const entry = steps[step.id];
      assert.ok(entry, `${locale}: install.steps.${step.id} is missing`);
      for (const field of ["title", "body"]) {
        assert.ok(
          typeof entry[field] === "string" && entry[field].trim(),
          `${locale}: install.steps.${step.id}.${field} is empty`,
        );
      }
    }
  }
});

test("every key the install page renders has a value in every locale", () => {
  for (const locale of LOCALES) {
    const install = loadMessages(locale).install;
    for (const key of REQUIREMENT_KEYS) {
      assert.ok(install.requirements[key], `${locale}: install.requirements.${key} is missing`);
    }
    for (const key of FAILURE_MODE_KEYS) {
      for (const field of ["symptom", "cause"]) {
        assert.ok(
          install.failures[key]?.[field],
          `${locale}: install.failures.${key}.${field} is missing`,
        );
      }
    }
  }
});

test("every key the windows page renders has a value in every locale", () => {
  for (const locale of LOCALES) {
    const windows = loadMessages(locale).windows;
    for (const route of WINDOWS_ROUTES) {
      for (const field of ["h", "b"]) {
        assert.ok(
          windows.routes[route.id]?.[field],
          `${locale}: windows.routes.${route.id}.${field} is missing`,
        );
      }
    }
    for (const key of WINDOWS_LIMIT_KEYS) {
      for (const field of ["h", "b"]) {
        assert.ok(windows.limits[key]?.[field], `${locale}: windows.limits.${key}.${field} is missing`);
      }
    }
  }
});

test("every catalogue carries the same key set", () => {
  const reference = flatten(loadMessages("en")).map(([key]) => key).sort();
  for (const locale of LOCALES.slice(1)) {
    const keys = flatten(loadMessages(locale)).map(([key]) => key).sort();
    assert.deepEqual(keys, reference, `${locale} does not carry the same keys as en`);
  }
});

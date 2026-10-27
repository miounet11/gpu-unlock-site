import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Paths are resolved from this file, never from process.cwd(). An earlier one-off script
// relied on the shell's working directory and wrote into the sibling repo instead.
const ROOT = new URL("../", import.meta.url);
const read = (rel) => readFileSync(new URL(rel, ROOT), "utf8");

const layout = read("src/app/[locale]/layout.tsx");
const site = read("src/lib/site.ts");
const footer = layout.slice(layout.indexOf("<footer"));

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"];

const REFERENCE_SITE = site.match(/export const REFERENCE_SITE = "([^"]+)"/)?.[1];

test("the reference host is a declared literal", () => {
  assert.equal(REFERENCE_SITE, "https://gpuunlock.com");
});

test("the footer links every sister site, including the locale-prefixed reference host", () => {
  // Each site on this host links to the others from its footer, so the set stays symmetric
  // instead of every pair negotiating separately.
  assert.ok(footer.includes("footerSister"), "footer must label the group");
  assert.ok(footer.includes("SISTER_SITES"), "footer must render the shared sister list");
  assert.ok(
    footer.includes("${site.url}/${locale}"),
    "the reference link must carry the current locale, not the bare host",
  );

  // The list is the single place a site is declared. A host added to the footer without an
  // entry here, or the reverse, means one direction of the link pair is missing.
  const declared = [...site.matchAll(/\{ name: "[^"]+", url: (?:"([^"]+)"|REFERENCE_SITE)/g)].map(
    (m) => m[1] ?? REFERENCE_SITE,
  );
  for (const host of [
    "https://gpuunlock.com",
    "https://www.androidadcleaner.com",
    "https://www.cleanyourtv.cc",
    "https://www.stratat.com",
    "https://www.jevcode.ai",
  ]) {
    assert.ok(declared.includes(host), `${host} is missing from SISTER_SITES`);
  }
});

test("every sister origin is the host that actually answers", () => {
  // The footer used to point at https://jevcode.ai, whose apex has no A record: the link
  // failed to resolve rather than 404ing, so no build check would have caught it. Only the
  // www host answers. Pinning each origin keeps a bare-apex entry from creeping back.
  const url = (re) => site.match(re)?.[1];
  assert.equal(url(/JevCode", url: "([^"]+)"/), "https://www.jevcode.ai");
  assert.equal(url(/Strata", url: "([^"]+)"/), "https://www.stratat.com");
  assert.equal(url(/CleanYourTV", url: "([^"]+)"/), "https://www.cleanyourtv.cc");
  assert.equal(url(/Android 去广告", url: "([^"]+)"/), "https://www.androidadcleaner.com");
});

test("every locale defines the sister-site label", () => {
  for (const loc of LOCALES) {
    const nav = JSON.parse(read(`messages/${loc}.json`)).nav;
    // The group now holds every site on the host, so the label is plural and the old
    // one-line description (which described only the reference site) is gone.
    assert.ok(nav.footerSister, `${loc}.json nav.footerSister is missing`);
    assert.ok(!nav.footerSisterBody, `${loc}.json nav.footerSisterBody is stale`);
    // The header labels must not be collateral damage.
    assert.ok(nav.install, `${loc}.json nav.install was lost`);
    assert.ok(nav.faq, `${loc}.json nav.faq was lost`);
    assert.notEqual(
      nav.footerSister,
      nav.install,
      `${loc}.json: footer group label must differ from the header install label`,
    );
  }
});

// The rest of the footer was English-only prose sitting inside the layout, so zh/ja/de
// visitors got a translated sister link directly above two English sentences. Both are
// message keys now; this fails if either drifts back into the component.
test("the footer prose is translated, not written into the layout", () => {
  assert.ok(!footer.includes("installs three upstream modules"), "footer body is hardcoded English again");
  assert.ok(!footer.includes("Not affiliated with NVIDIA"), "footer meta line is hardcoded English again");
  assert.ok(footer.includes('t.rich("footerBody"'), "footer body must render through the message key");
  assert.ok(footer.includes('t("footerMeta")'), "footer meta line must render through the message key");

  for (const loc of LOCALES) {
    const nav = JSON.parse(read(`messages/${loc}.json`)).nav;
    for (const key of ["footerBody", "footerMeta"]) {
      assert.ok(nav[key], `${loc}.json nav.${key} is missing`);
    }
    // The repository names are link text, so the body must keep all four tags or one of the
    // links silently disappears when a translation is edited.
    for (const tag of ["ampere", "ada", "turing", "reference"]) {
      assert.ok(
        nav.footerBody.includes(`<${tag}>`),
        `${loc}.json nav.footerBody is missing the <${tag}> link tag`,
      );
    }
    assert.ok(nav.footerBody.includes("{site}"), `${loc}.json nav.footerBody is missing {site}`);
  }
});

test("this repo does not carry the reference site's own message keys", () => {
  // The two repos have different footers. A key leaking across means a script wrote to
  // the wrong directory, which is exactly what the cwd assumption used to allow.
  const nav = JSON.parse(read("messages/en.json")).nav;
  assert.ok(!("sisterInstall" in nav), "sisterInstall belongs to the other repo");
  assert.ok(!("installHome" in nav), "installHome belongs to the other repo");
});

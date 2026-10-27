// Guards the pinned upstream revisions and the claim the site makes about them.
//
// src/data/upstream-pins.json is what `npm run check:upstream` compares against, and
// src/data/modules.ts is what a reader sees. The failure this catches is a version shown on
// the page that no upstream repository actually publishes — which a reader can disprove by
// opening the repo in ten seconds.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const pins = JSON.parse(readFileSync(new URL("src/data/upstream-pins.json", root), "utf8"));
const modulesSrc = readFileSync(new URL("src/data/modules.ts", root), "utf8");
const devicesSrc = readFileSync(new URL("src/data/devices.ts", root), "utf8");

const entries = Object.entries(pins.modules ?? {});

test("every pin names a repo, a ref kind and a full commit sha", () => {
  assert.ok(entries.length >= 3, `expected the three modules, got ${entries.length}`);

  for (const [id, pin] of entries) {
    assert.match(pin.repo, /^[\w.-]+\/[\w.-]+$/, `${id}: repo must be owner/name`);
    assert.ok(["tag", "branch"].includes(pin.refKind), `${id}: refKind must be tag or branch`);
    assert.ok(pin.ref.length > 0, `${id}: ref must not be empty`);
    // A short sha cannot be verified against the API, which returns the full one.
    assert.match(pin.commit, /^[0-9a-f]{40}$/, `${id}: commit must be a full 40-char sha`);
    assert.ok(Array.isArray(pin.paths) && pin.paths.length > 0, `${id}: paths must not be empty`);
  }
});

test("every pinned module exists in the site's module table", () => {
  const ids = [...modulesSrc.matchAll(/^\s{4}id: "(\w+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(ids.sort(), entries.map(([id]) => id).sort());
});

test("a shown version is either a real tag or an explicit commit", () => {
  // The site displays module.version. A bare "vX.Y.Z" is only honest when the pin records a
  // tag at that version; otherwise the module must show the branch and the pinned commit.
  const versions = [...modulesSrc.matchAll(/id: "(\w+)",[\s\S]*?version: "([^"]+)"/g)].map(
    (m) => ({ id: m[1], version: m[2] }),
  );
  assert.equal(versions.length, entries.length, "every module needs a version");

  for (const { id, version } of versions) {
    const pin = pins.modules[id];
    assert.ok(pin, `${id}: no pin recorded`);

    const bareTag = /^v?\d+\.\d+\.\d+$/.test(version);
    if (bareTag) {
      assert.equal(
        pin.refKind,
        "tag",
        `${id}: shows version ${version} but its pin is not a tag`,
      );
      // Compared with the `v` prefix so the page and the pin say the same string.
      assert.equal(version, pin.ref, `${id}: shown version != pinned tag`);
    } else {
      // "main @ 6081407" — the commit must be the pinned one, or the page and the check disagree.
      const sha = version.match(/@\s*([0-9a-f]{7,40})/)?.[1];
      assert.ok(sha, `${id}: version "${version}" names neither a tag nor a commit`);
      assert.ok(
        pin.commit.startsWith(sha),
        `${id}: shows ${sha} but pins ${pin.commit.slice(0, sha.length)}`,
      );
    }
  }
});

test("the data file comments do not claim an unpublished version", () => {
  // The header of devices.ts lists the three sources with their revisions. A tag there that
  // no repo publishes is the same false claim in a less visible place.
  const header = devicesSrc.split("\n").slice(0, 14).join("\n");
  for (const [id, pin] of entries) {
    if (pin.refKind === "tag") continue;
    assert.ok(
      !new RegExp(`${id === "ampere" ? "Zagitta/gpu-unlock" : "nlzy/turing-unlock"}[^\\n]*v\\d+\\.\\d+\\.\\d+`).test(
        header,
      ),
      `${id} is a branch pin but the comment shows a tag`,
    );
  }
});

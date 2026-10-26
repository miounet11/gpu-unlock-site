// Facts for the Windows route, taken from impacifist/Windows-GPU-UNLOCK at the pinned
// v0.3.1 tag (commit 9352abd27480203ea146f766e7c96957912d148a).
//
// This is a different mechanism from the Linux modules on the rest of the site: a UEFI
// application unlocks the card and chain-loads the Windows Boot Manager, so the card is
// unlocked and back under the stock Windows driver in one boot. The commands below are
// copied verbatim from docs/GUIDE.en.md and docs/HEADLESS.en.md — an option name or a path
// that has been translated is a command that fails, so nothing here is localised.
//
// Only structure, commands and recorded values live here. Every sentence a reader sees
// comes from messages/<locale>.json under the `windows` namespace.

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface WindowsRoute {
  /** Matches windows.routes.<id> in the message files and produces the #route-<id> anchor. */
  id: string;
  code?: string;
}

export const WINDOWS_ROUTES: WindowsRoute[] = [
  {
    id: "source",
    code:
      "git clone --branch v0.3.1 --depth 1 https://github.com/impacifist/Windows-GPU-UNLOCK.git\ncd Windows-GPU-UNLOCK",
  },
  {
    id: "usb",
    code: "python .\\tools\\prepare_usb.py --assets .\\assets --output .\\usb-package",
  },
  {
    id: "internal",
    code:
      ".\\internal-boot\\Configure.ps1 -UnlockDriveLetter U -WindowsEspGuid 'WINDOWS-ESP-GUID-HERE'\n.\\internal-boot\\Build.ps1 -Clang 'C:\\TOOLS\\LLVM20\\bin\\clang.exe' -LldLink 'C:\\TOOLS\\LLVM20\\bin\\lld-link.exe'",
  },
  {
    id: "headless",
    code:
      "# Stage only: no boot entry, boot-order or Fast Startup change.\n.\\internal-boot\\Headless.ps1 -Assets '.\\assets'\n\n# Stage and append a separate F8 entry, retaining existing boot priority.\n.\\internal-boot\\Headless.ps1 -Assets '.\\assets' -Register",
  },
  {
    id: "restore",
    code: ".\\internal-boot\\Headless.ps1 -RestoreWindowsFirst",
  },
];

/**
 * The five assets the packaging tool and the UEFI application both hash-check. They are
 * NVIDIA firmware and are not redistributable, so neither the repository nor the installer
 * contains them. Order matches docs/ASSETS.en.md.
 */
export const WINDOWS_ASSETS = [
  "booter_load_ga102.bin",
  "v67-ga102-610.43.03.bin",
  "gsp_ga10x.bin",
  "gsp_boot_ga102.bin",
  "gsp_boot_desc_ga102.bin",
] as const;

/**
 * The one documented successful profile. Values are recorded facts about the tested
 * machine; the labels are translated by key. Nothing here is an allowlist.
 */
export const WINDOWS_PROFILE = [
  { key: "card", value: "NVIDIA RTX 3090 Founders Edition, 24 GiB" },
  { key: "pci", value: "10de:2204 / subsystem 10de:1454" },
  { key: "bdf", value: "0000:01:00.0" },
  { key: "board", value: "ASUS TUF GAMING B650M-PLUS WIFI / BIOS 3057" },
  { key: "cpu", value: "AMD Ryzen 7 7800X3D" },
  { key: "os", value: "Windows 11 Home 26200 / NVIDIA 617.14" },
  { key: "uefi", value: "x64 UEFI / Secure Boot disabled" },
  {
    key: "prom",
    value: "8ea297373e9e5d3600ff41ad9fae88f2d14c98c017d100669f7333981da673b4",
  },
] as const;

/** Same-card before/after, median of three runs each, from the v0.1.0 release notes. */
export const WINDOWS_BENCH = [
  { key: "fp16", before: "70.55", after: "125.91", delta: "+78.5%" },
  { key: "bf16", before: "70.53", after: "128.70", delta: "+82.5%" },
] as const;

/** Order of windows.limits.* — kept here so every locale must carry the same entries. */
export const WINDOWS_LIMIT_KEYS = [
  "one-pc",
  "no-firmware",
  "safety",
  "untested",
] as const;

/**
 * The installer this site builds, and the archive it is built from.
 *
 * `installerSha256` is read from the `.sha256` file `npm run build:installer` writes next to
 * the executable, so the page cannot drift from the artifact it offers. If the installer has
 * not been built yet the value is null and the page says so instead of printing a stale hash.
 */
export const WINDOWS_PACKAGE = {
  version: "0.3.1",
  sourceCommit: "9352abd27480203ea146f766e7c96957912d148a",
  sourceSha256:
    "d81ddec78fb260f6e9bbb0e5d66d4b9d168dbe53222813d2cce9c2e29e07d9c6",
  fileName: "GPU-Unlock-Windows-0.3.1-Setup.exe",
  downloadPath: "/downloads/GPU-Unlock-Windows-0.3.1-Setup.exe",
  buildCommand: "npm run build:installer",
} as const;

export function readInstallerSha256(): string | null {
  try {
    const file = join(
      process.cwd(),
      "public",
      "downloads",
      `${WINDOWS_PACKAGE.fileName}.sha256`,
    );
    const line = readFileSync(file, "utf8").trim();
    // Format is "<hex>  <file name>", as written by sha256sum.
    return /^[0-9a-f]{64}$/.test(line.split(/\s+/)[0]) ? line.split(/\s+/)[0] : null;
  } catch {
    return null;
  }
}

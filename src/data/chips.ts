// Chip-level pages.
//
// The card pages answer "does my card work". They cannot answer the question people actually
// ask before they know which card they have: whether the unlock is decided per chip or per
// card. It is per chip for the fuse and per card for the measurement, and that distinction is
// the reason this family exists — every claim here is derived from DEVICES and the benchmark
// rows, so a chip page that has no measurements says exactly that instead of going unwritten.
//
// Family comes from the chip prefix because that is what the upstream modules themselves key
// on: AD* is the Ada fork, GA* the Ampere module, TU* the separate Turing module. Deriving it
// from the prefix means a new chip entry cannot be filed under the wrong module page.

import { DEVICES, type Device, type DeviceStatus } from "./devices.ts";
import { cardStats, type CardStats } from "./answers.ts";

export type ChipFamily = "ada" | "ampere" | "turing";

export interface ChipStats {
  /** Lowercase chip id, as it appears in the URL. */
  slug: string;
  /** Upper-case chip id, as it appears in nvidia-smi and the module sources. */
  chip: string;
  family: ChipFamily;
  devices: Device[];
  /** Devices with a published same-card measurement upstream. */
  measured: Device[];
  /** Devices this site has benchmark rows for. */
  benchmarked: Device[];
  statusCounts: Record<DeviceStatus, number>;
  rows: number;
  improved: number;
  best: { device: Device; stats: CardStats } | null;
  /** Which upstream forks accept at least one device on this chip. */
  forks: string[];
}

const PCI = "10de";

export function chipFamily(chip: string): ChipFamily {
  if (chip.startsWith("AD")) return "ada";
  if (chip.startsWith("GA")) return "ampere";
  return "turing";
}

/** Mobile parts carry an M suffix on the chip (AD103M, AD107M). */
export function isMobileChip(chip: string): boolean {
  return /M$/.test(chip);
}

const EMPTY_COUNTS: Record<DeviceStatus, number> = {
  measured: 0,
  reported: 0,
  partial: 0,
  untested: 0,
  unsupported: 0,
};

function buildChip(chip: string, devices: Device[]): ChipStats {
  const statusCounts = { ...EMPTY_COUNTS };
  for (const device of devices) statusCounts[device.status] += 1;

  const measured = devices.filter((device) => device.status === "measured");
  const benchmarked = devices.filter((device) => cardStats(device.slug).rows > 0);
  const rows = benchmarked.reduce((sum, device) => sum + cardStats(device.slug).rows, 0);
  const improved = benchmarked.reduce(
    (sum, device) => sum + cardStats(device.slug).improved,
    0,
  );
  const best = benchmarked.reduce<ChipStats["best"]>((acc, device) => {
    const stats = cardStats(device.slug);
    if (!stats.best) return acc;
    if (!acc || stats.best.ratio > (acc.stats.best?.ratio ?? 0)) return { device, stats };
    return acc;
  }, null);

  return {
    slug: chip.toLowerCase(),
    chip,
    family: chipFamily(chip),
    devices: [...devices].sort((a, b) => a.name.localeCompare(b.name)),
    measured,
    benchmarked,
    statusCounts,
    rows,
    improved,
    best,
    forks: [...new Set(devices.map((device) => device.fork))].sort(),
  };
}

export const CHIPS: ChipStats[] = [...new Set(DEVICES.map((device) => device.chip))]
  .sort()
  .map((chip) => buildChip(chip, DEVICES.filter((device) => device.chip === chip)));

export function getChip(slug: string): ChipStats | undefined {
  return CHIPS.find((chip) => chip.slug === slug);
}

/** Families that own at least one chip, in the order the modules were written. */
export const FAMILIES: ChipFamily[] = ["ampere", "ada", "turing"];

export function chipsInFamily(family: ChipFamily): ChipStats[] {
  return CHIPS.filter((chip) => chip.family === family);
}

export { PCI };

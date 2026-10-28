// Query-shaped answer pages.
//
// Every page here answers one question a person would actually type, and the answer is
// assembled from the same card and benchmark data the rest of the site renders. Nothing is
// written by hand: a card answer reports what the evidence folder says, a mode answer counts
// the rows that moved, and a comparison pits two measured cards against each other.
//
// The page prose lives in the `answers` message namespace, so the question and the answer are
// translated while the identifiers (PCI IDs, mode names, chip names) stay in one form.

import { BENCH_RUNS, type BenchRow } from "./benchmarks.ts";
import { DEVICES, getDevice, type Device } from "./devices.ts";
import {
  getModeGroup,
  groupForRow,
  groupSlug,
  pageGroups,
  type ModeGroup,
  type ModeGroupId,
} from "./modes.ts";

/** A path counts as improved when the unlocked run is at least 5% faster. */
export const MOVED_RATIO = 1.05;

export const ALL_ROWS: BenchRow[] = BENCH_RUNS.flatMap((run) => run.rows);

export function rowsForCard(cardSlug: string): BenchRow[] {
  return ALL_ROWS.filter((row) => row.cardSlug === cardSlug);
}

export function rowsForMode(id: ModeGroupId): BenchRow[] {
  return ALL_ROWS.filter((row) => groupForRow(row.mode) === id);
}

export function sourceForCard(cardSlug: string): string | null {
  return BENCH_RUNS.find((run) => run.cardSlug === cardSlug)?.source ?? null;
}

export interface CardStats {
  rows: number;
  improved: number;
  flat: number;
  best: BenchRow | null;
}

export function cardStats(cardSlug: string): CardStats {
  const rows = rowsForCard(cardSlug);
  const improved = rows.filter((row) => row.ratio >= MOVED_RATIO).length;
  const best = rows.reduce<BenchRow | null>(
    (acc, row) => (!acc || row.ratio > acc.ratio ? row : acc),
    null,
  );
  return { rows: rows.length, improved, flat: rows.length - improved, best };
}

export interface ModeStats {
  rows: number;
  cards: number;
  improved: number;
  flat: number;
  best: BenchRow | null;
  cardNames: string[];
}

export function modeStats(id: ModeGroupId): ModeStats {
  const rows = rowsForMode(id);
  const improved = rows.filter((row) => row.ratio >= MOVED_RATIO).length;
  const best = rows.reduce<BenchRow | null>(
    (acc, row) => (!acc || row.ratio > acc.ratio ? row : acc),
    null,
  );
  const slugs = [...new Set(rows.map((row) => row.cardSlug))];
  return {
    rows: rows.length,
    cards: slugs.length,
    improved,
    flat: rows.length - improved,
    best,
    cardNames: slugs.map((slug) => getDevice(slug)?.name ?? slug),
  };
}

export interface PairStats {
  a: { device: Device; stats: CardStats };
  b: { device: Device; stats: CardStats };
  /**
   * Whichever card improved on the larger *share* of its measured paths; "tie" when the shares
   * match. Counting raw rows compares denominators: 4 of 8 and 2 of 3 are four versus two, but
   * 50% versus 67%, and only the share answers "which card responds more reliably".
   */
  winner: "a" | "b" | "tie";
  /** Improved share per card, 0..1. */
  aShare: number;
  bShare: number;
  /**
   * False when either card has no published row, because there is then nothing to compare.
   * A card with no measurement is not a card that failed, and scoring it 0% would say exactly
   * that, so the page states no winner instead of inventing one.
   */
  comparable: boolean;
  best: BenchRow | null;
}

/** Pairs are curated, not the full cross product: 13 measured cards would make 78 pages. */
const COMPARE_PAIRS: [string, string][] = [
  ["rtx-4090", "rtx-4080"],
  ["rtx-4090", "rtx-4070-super"],
  ["rtx-4080", "rtx-4070-ti"],
  ["rtx-4070-ti", "rtx-4070"],
  ["rtx-4060-ti-16gb", "rtx-4060"],
  ["rtx-4080-super", "rtx-4070-ti-super"],
  ["rtx-4090", "rtx-2080-ti"],
  ["rtx-3050-6gb", "rtx-4060"],
];

export function pairStats(aSlug: string, bSlug: string): PairStats | null {
  const aDevice = getDevice(aSlug);
  const bDevice = getDevice(bSlug);
  if (!aDevice || !bDevice) return null;

  const a = { device: aDevice, stats: cardStats(aSlug) };
  const b = { device: bDevice, stats: cardStats(bSlug) };
  const best = [a.stats.best, b.stats.best]
    .filter((row): row is BenchRow => row !== null)
    .reduce<BenchRow | null>((acc, row) => (!acc || row.ratio > acc.ratio ? row : acc), null);

  // Share, not count. `0/0` stays undefined instead of becoming 0%.
  const aShare = a.stats.rows === 0 ? null : a.stats.improved / a.stats.rows;
  const bShare = b.stats.rows === 0 ? null : b.stats.improved / b.stats.rows;
  const comparable = aShare !== null && bShare !== null;

  const winner =
    !comparable
      ? ("tie" as const)
      : Math.abs(aShare - bShare) < 1e-9
        ? ("tie" as const)
        : aShare > bShare
          ? ("a" as const)
          : ("b" as const);

  return {
    a,
    b,
    winner,
    aShare: aShare ?? 0,
    bShare: bShare ?? 0,
    comparable,
    best,
  };
}

export type AnswerKind = "card" | "mode" | "compare";

export interface AnswerRef {
  slug: string;
  kind: AnswerKind;
  cardSlug?: string;
  modeId?: ModeGroupId;
  pair?: [string, string];
}

export function cardAnswerSlug(cardSlug: string): string {
  return `does-${cardSlug}-support-gpu-unlock`;
}

export function modeAnswerSlug(id: ModeGroupId): string {
  return `how-much-does-gpu-unlock-raise-${groupSlug(id)}`;
}

export function compareAnswerSlug(a: string, b: string): string {
  return `${a}-vs-${b}`;
}

function buildAnswerPages(): AnswerRef[] {
  const cards: AnswerRef[] = DEVICES.map((device) => ({
    slug: cardAnswerSlug(device.slug),
    kind: "card",
    cardSlug: device.slug,
  }));

  // Same predicate as the mode pages and the sitemap: a group gets an answer only when it has
  // rows to report. A group with no rows would publish an empty answer.
  const modes: AnswerRef[] = pageGroups((id) => rowsForMode(id).length).map((group) => ({
    slug: modeAnswerSlug(group.id),
    kind: "mode",
    modeId: group.id,
  }));

  const compares: AnswerRef[] = COMPARE_PAIRS.flatMap(([a, b]) =>
    pairStats(a, b) ? [{ slug: compareAnswerSlug(a, b), kind: "compare" as const, pair: [a, b] as [string, string] }] : [],
  );

  return [...cards, ...modes, ...compares];
}

export const ANSWER_PAGES: AnswerRef[] = buildAnswerPages();

export function getAnswerRef(slug: string): AnswerRef | undefined {
  return ANSWER_PAGES.find((page) => page.slug === slug);
}

export function modeForRef(ref: AnswerRef): ModeGroup | undefined {
  return ref.modeId ? getModeGroup(ref.modeId) : undefined;
}

/**
 * The pages worth reading next. A card answer points at the paths it was measured on and at
 * the comparisons it appears in; a comparison points back at its two cards.
 */
export function relatedAnswers(ref: AnswerRef, limit = 6): AnswerRef[] {
  if (ref.kind === "card" && ref.cardSlug) {
    const groups = [
      ...new Set(
        rowsForCard(ref.cardSlug)
          .map((row) => groupForRow(row.mode))
          .filter((id): id is ModeGroupId => id !== null),
      ),
    ];
    const modes = groups
      .map((id) => ANSWER_PAGES.find((page) => page.kind === "mode" && page.modeId === id))
      .filter((page): page is AnswerRef => Boolean(page));
    const compares = ANSWER_PAGES.filter(
      (page) => page.kind === "compare" && page.pair?.includes(ref.cardSlug!),
    );
    return [...modes, ...compares].slice(0, limit);
  }

  if (ref.kind === "mode" && ref.modeId) {
    const slugs = [...new Set(rowsForMode(ref.modeId).map((row) => row.cardSlug))];
    const cards = slugs
      .map((slug) => ANSWER_PAGES.find((page) => page.kind === "card" && page.cardSlug === slug))
      .filter((page): page is AnswerRef => Boolean(page));
    const compares = ANSWER_PAGES.filter((page) => page.kind === "compare").slice(0, 1);
    return [...cards, ...compares].slice(0, limit);
  }

  const pair = ref.pair ?? [];
  const cards = pair
    .map((slug) => ANSWER_PAGES.find((page) => page.kind === "card" && page.cardSlug === slug))
    .filter((page): page is AnswerRef => Boolean(page));
  const modes = ANSWER_PAGES.filter((page) => page.kind === "mode").slice(0, 3);
  return [...cards, ...modes].slice(0, limit);
}

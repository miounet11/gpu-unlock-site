// Scenario pages.
//
// A scenario answers "will this help me do X?", which is the question people actually type.
// It is not a new set of measurements: each scenario names the measurement paths that the
// workload exercises, and the page reports what those paths did across every card that was
// measured. That keeps the claim tied to the evidence instead of to prose.
//
// `verdict` is derived, never written by hand. A scenario only claims a gain when most of its
// rows moved; when most of them did not, the page says so. The quantised-inference scenario
// exists precisely because those paths do not move, and a site that only publishes good news
// is a site a retrieval system stops trusting.

import { BENCH_RUNS, type BenchRow } from "./benchmarks.ts";
import { getModeGroup, groupForRow, type ModeGroupId } from "./modes.ts";

export interface ScenarioRow extends BenchRow {
  chip: string;
}

export type Verdict = "moved" | "mixed" | "flat";

export interface Scenario {
  slug: string;
  /** The measurement paths this workload actually runs through. */
  modes: ModeGroupId[];
  /** Card slugs the scenario page links to, most-improved first. */
  cards: string[];
  rows: ScenarioRow[];
  /** Distinct cards behind the numbers. */
  cardCount: number;
  improved: number;
  best: ScenarioRow | null;
  verdict: Verdict;
}

const ALL: ScenarioRow[] = BENCH_RUNS.flatMap((run) =>
  run.rows.map((row) => ({ ...row, chip: run.chip })),
);

const DEFINITIONS: { slug: string; modes: ModeGroupId[] }[] = [
  { slug: "local-llm-inference", modes: ["tensor-f16-f32", "gemm-f16-f32", "tensor-bf16-f32"] },
  { slug: "fine-tuning", modes: ["tensor-bf16-f32", "tensor-tf32", "gemm-f16-f32"] },
  { slug: "stable-diffusion", modes: ["tensor-f16-f32", "tensor-f16-f16"] },
  { slug: "quantized-inference", modes: ["tensor-int8", "tensor-int4", "dp4a"] },
];

/** Same 5% floor the answer pages use, so the two page families cannot disagree. */
const MOVED = 1.05;

function build(slug: string, modes: ModeGroupId[]): Scenario {
  const rows = ALL.filter((row) => {
    const group = groupForRow(row.mode);
    return group !== null && modes.includes(group);
  });
  const improved = rows.filter((row) => row.ratio >= MOVED).length;
  const best = rows.reduce<ScenarioRow | null>(
    (acc, row) => (!acc || row.ratio > acc.ratio ? row : acc),
    null,
  );
  const share = rows.length === 0 ? 0 : improved / rows.length;
  const verdict: Verdict = share >= 0.8 ? "moved" : share <= 0.2 ? "flat" : "mixed";
  const cards = [...new Set(rows.map((row) => row.cardSlug))].sort((a, b) => {
    const bestOf = (slug: string) =>
      Math.max(...rows.filter((row) => row.cardSlug === slug).map((row) => row.ratio));
    return bestOf(b) - bestOf(a);
  });
  return { slug, modes, cards, rows, cardCount: cards.length, improved, best, verdict };
}

export const SCENARIOS: Scenario[] = DEFINITIONS.map((d) => build(d.slug, d.modes));

export function getScenario(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}

/** Human-readable labels for the paths a scenario names, for the evidence table header. */
export function modeNames(modes: ModeGroupId[]): string[] {
  return modes.map((id) => getModeGroup(id)?.name ?? id);
}

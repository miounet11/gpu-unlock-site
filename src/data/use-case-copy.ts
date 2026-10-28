// The prose side of a scenario page: the question it answers and the verdict line.
//
// These live here rather than in the page files because both the index and the detail page
// need them, and a page file that exports extra helpers fails Next's export validation. The
// keys are all literals so a missing translation shows up as a missing key, not as a fallback.

import type { Scenario } from "./use-cases.ts";

export type T = (key: string, values?: Record<string, string | number | Date>) => string;

export function scenarioName(slug: string, t: T): string {
  if (slug === "local-llm-inference") return t("nameLocalLlm");
  if (slug === "fine-tuning") return t("nameFineTuning");
  if (slug === "stable-diffusion") return t("nameStableDiffusion");
  if (slug === "quantized-inference") return t("nameQuantizedInference");
  return slug;
}

/** The question a person types, used as the page title and the h1. */
export function scenarioQuestion(slug: string, t: T): string {
  if (slug === "local-llm-inference") return t("questionLocalLlm");
  if (slug === "fine-tuning") return t("questionFineTuning");
  if (slug === "stable-diffusion") return t("questionStableDiffusion");
  if (slug === "quantized-inference") return t("questionQuantizedInference");
  return slug;
}

/**
 * One sentence stating what the measurements did, chosen by the derived verdict. A scenario
 * with a flat verdict gets the same treatment as one that moved: the numbers are the claim.
 */
export function verdictLine(scenario: Scenario, t: T): string {
  const values = {
    improved: scenario.improved,
    rows: scenario.rows.length,
    cards: scenario.cardCount,
    best: scenario.best?.card ?? "",
    ratio: (scenario.best?.ratio ?? 1).toFixed(2),
  };
  if (scenario.verdict === "moved") return t("verdictMoved", values);
  if (scenario.verdict === "flat") return t("verdictFlat", values);
  return t("verdictMixed", values);
}

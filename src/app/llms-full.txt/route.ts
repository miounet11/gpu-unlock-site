import { getTranslations } from "next-intl/server";
import {
  ANSWER_PAGES,
  cardStats,
  modeStats,
  pairStats,
  type AnswerRef,
} from "@/data/answers";
import { getDevice } from "@/data/devices";
import { getModeGroup } from "@/data/modes";
import { MODULES } from "@/data/modules";
import { SCENARIOS } from "@/data/use-cases";
import { scenarioQuestion, verdictLine } from "@/data/use-case-copy";
import { REPOS, SITE } from "@/lib/site";

export const dynamic = "force-static";

/**
 * The corpus file. llms.txt is the index a retrieval step starts from; this is what it reads
 * once it has decided the site is relevant. Every answered question appears here with its
 * answer and its source URL, in English only — the locale pages are for people, and shipping
 * seven near-identical copies of the same corpus would bury the useful text.
 */
export async function GET() {
  const t = await getTranslations({ locale: "en", namespace: "answers" });
  const tUC = await getTranslations({ locale: "en", namespace: "useCases" });
  const lines: string[] = [];

  const titleFor = (ref: AnswerRef): string => {
    if (ref.kind === "card") {
      return t("questionCard", { name: getDevice(ref.cardSlug ?? "")?.name ?? ref.cardSlug ?? "" });
    }
    if (ref.kind === "mode") {
      return t("questionMode", {
        mode: getModeGroup(ref.modeId!)?.name ?? ref.modeId ?? "",
      });
    }
    const [a = "", b = ""] = ref.pair ?? [];
    return t("questionCompare", {
      a: getDevice(a)?.name ?? a,
      b: getDevice(b)?.name ?? b,
    });
  };

  const ratio = (value: number): string => `${value.toFixed(2)}×`;

  const answerFor = (ref: AnswerRef): string => {
    if (ref.kind === "card") {
      const device = getDevice(ref.cardSlug ?? "");
      if (!device) return "";
      const stats = cardStats(ref.cardSlug!);
      return t("answerCard", {
        name: device.name,
        status: device.status,
        rows: stats.rows,
        improved: stats.improved,
        best: stats.best?.mode ?? "—",
        bestRatio: ratio(stats.best?.ratio ?? 1),
      });
    }
    if (ref.kind === "mode") {
      const group = getModeGroup(ref.modeId!);
      if (!group) return "";
      const stats = modeStats(ref.modeId!);
      return t("answerMode", {
        mode: group.name,
        cards: stats.cards,
        rows: stats.rows,
        improved: stats.improved,
        best: stats.best?.card ?? "—",
        bestRatio: ratio(stats.best?.ratio ?? 1),
      });
    }
    const [a = "", b = ""] = ref.pair ?? [];
    const pair = pairStats(a, b);
    if (!pair) return "";
    const winner = !pair.comparable
      ? t("compareNoData")
      : pair.winner === "a"
        ? t("compareWinner", {
            name: pair.a.device.name,
            share: Math.round(pair.aShare * 100),
          })
        : pair.winner === "b"
          ? t("compareWinner", {
              name: pair.b.device.name,
              share: Math.round(pair.bShare * 100),
            })
          : t("compareTie");
    return t("answerCompare", {
      a: pair.a.device.name,
      aImproved: pair.a.stats.improved,
      aRows: pair.a.stats.rows,
      aShare: Math.round(pair.aShare * 100),
      b: pair.b.device.name,
      bImproved: pair.b.stats.improved,
      bRows: pair.b.stats.rows,
      bShare: Math.round(pair.bShare * 100),
      verdict: winner,
    });
  };

  lines.push("# GPU Unlock — full answer corpus");
  lines.push("");
  lines.push(
    "Every question this site answers, with the answer and the canonical URL. English only; the site also publishes the same pages in zh, ja, de, fr, es and pt.",
  );
  lines.push("");

  lines.push("## What the project is");
  lines.push("");
  lines.push(
    "GPU Unlock is a set of three out-of-tree Linux kernel modules that clear the NVIDIA SM speed-select fuse, so a card reserved by the stock driver for reduced tensor throughput runs at its full rate. It is not a driver and not a vBIOS flash: the module writes the registers, then the stock NVIDIA driver binds the card as usual.",
  );
  lines.push("");

  lines.push("## Modules");
  lines.push("");
  for (const m of MODULES) {
    lines.push(`### ${m.id} — ${m.module}`);
    lines.push(`- Chips: ${m.chips}`);
    lines.push(`- Kernel parameter: \`${m.parameter}\``);
    lines.push(`- Version: ${m.version}`);
    lines.push(`- Upstream: ${m.repo}`);
    lines.push("");
  }

  lines.push("## Workload scenarios");
  lines.push("");
  for (const scenario of SCENARIOS) {
    lines.push(`### ${scenarioQuestion(scenario.slug, tUC)}`);
    lines.push(verdictLine(scenario, tUC));
    lines.push(`Paths: ${scenario.modes.join(", ")}`);
    lines.push(`Source: ${SITE}/en/use-cases/${scenario.slug}`);
    lines.push("");
  }

  lines.push("## Questions and answers");
  lines.push("");
  const groups: [string, AnswerRef[]][] = [
    ["Per card", ANSWER_PAGES.filter((r) => r.kind === "card")],
    ["Per measurement path", ANSWER_PAGES.filter((r) => r.kind === "mode")],
    ["Comparisons", ANSWER_PAGES.filter((r) => r.kind === "compare")],
  ];
  for (const [heading, refs] of groups) {
    lines.push(`### ${heading}`);
    lines.push("");
    for (const ref of refs) {
      const question = titleFor(ref);
      const answer = answerFor(ref);
      const url = `${SITE}/en/answers/${ref.slug}`;
      lines.push(`**${question}**`);
      if (answer) lines.push(answer);
      lines.push(`Source: ${url}`);
      lines.push("");
    }
  }

  lines.push("## Source repositories");
  lines.push(`- Ampere: ${REPOS.ampere}`);
  lines.push(`- Ada: ${REPOS.ada}`);
  lines.push(`- Turing: ${REPOS.turing}`);
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

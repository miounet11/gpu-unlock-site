import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ANSWER_PAGES,
  MOVED_RATIO,
  cardStats,
  getAnswerRef,
  modeStats,
  pairStats,
  relatedAnswers,
  rowsForCard,
  rowsForMode,
  sourceForCard,
  type AnswerRef,
} from "@/data/answers";
import { getDevice } from "@/data/devices";
import { getModeGroup, groupForRow, type ModeGroupId } from "@/data/modes";
import { SCENARIOS, type Scenario } from "@/data/use-cases";
import { scenarioQuestion } from "@/data/use-case-copy";
import { breadcrumbLd, faqLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return ANSWER_PAGES.map((page) => ({ slug: page.slug }));
}

type T = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * The title of an answer is the question itself, in the reader's language, so a search result
 * and the citation an assistant quotes read the same. The identifiers inside stay untranslated.
 */
function titleFor(ref: AnswerRef, t: T): string {
  if (ref.kind === "card") {
    return t("questionCard", { name: getDevice(ref.cardSlug ?? "")?.name ?? ref.cardSlug ?? "" });
  }
  if (ref.kind === "mode") {
    return t("questionMode", { mode: getModeGroup(ref.modeId!)?.name ?? ref.modeId ?? "" });
  }
  const [a = "", b = ""] = ref.pair ?? [];
  return t("questionCompare", {
    a: getDevice(a)?.name ?? a,
    b: getDevice(b)?.name ?? b,
  });
}

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}×`;
}

/**
 * The scenarios this answer has evidence for, decided by the rows behind it rather than by a
 * list. A card measured on tensor paths links to the inference and fine-tuning scenarios; the
 * same card does not get linked from quantised inference unless it was measured there, because
 * this page cannot speak for a path it did not measure.
 */
function scenariosFor(ref: AnswerRef): Scenario[] {
  let covered: Set<ModeGroupId>;
  if (ref.kind === "card" && ref.cardSlug) {
    covered = new Set(
      rowsForCard(ref.cardSlug)
        .map((row) => groupForRow(row.mode))
        .filter((id): id is ModeGroupId => id !== null),
    );
  } else if (ref.kind === "mode" && ref.modeId) {
    covered = new Set([ref.modeId as ModeGroupId]);
  } else {
    const [a = "", b = ""] = ref.pair ?? [];
    covered = new Set(
      [...rowsForCard(a), ...rowsForCard(b)]
        .map((row) => groupForRow(row.mode))
        .filter((id): id is ModeGroupId => id !== null),
    );
  }
  return SCENARIOS.filter((scenario) => scenario.modes.some((id) => covered.has(id)));
}

/** The answer, as one paragraph, before any table. This is the text an assistant quotes. */
function directAnswer(ref: AnswerRef, t: T): string {
  if (ref.kind === "card" && ref.cardSlug) {
    const device = getDevice(ref.cardSlug);
    if (!device) return "";
    const stats = cardStats(ref.cardSlug);
    if (stats.rows === 0) {
      return t("answerCardNoRows", { name: device.name, status: t(`status.${device.status}`) });
    }
    return t("answerCard", {
      name: device.name,
      status: t(`status.${device.status}`),
      rows: stats.rows,
      improved: stats.improved,
      best: stats.best?.mode ?? "—",
      bestRatio: stats.best ? formatRatio(stats.best.ratio) : "—",
    });
  }

  if (ref.kind === "mode" && ref.modeId) {
    const group = getModeGroup(ref.modeId);
    if (!group) return "";
    const stats = modeStats(ref.modeId);
    return t("answerMode", {
      mode: group.name,
      cards: stats.cards,
      rows: stats.rows,
      improved: stats.improved,
      best: stats.best ? getDevice(stats.best.cardSlug)?.name ?? stats.best.cardSlug : "—",
      bestRatio: stats.best ? formatRatio(stats.best.ratio) : "—",
    });
  }

  const [a = "", b = ""] = ref.pair ?? [];
  const pair = pairStats(a, b);
  if (!pair) return "";
  const winnerName =
    pair.winner === "a" ? pair.a.device.name : pair.winner === "b" ? pair.b.device.name : null;
  // A card with no rows is not a card that failed, so an unmeasured pair states no winner
  // rather than defaulting to a tie, which would read as "both were measured and equal".
  const verdict = !pair.comparable
    ? t("compareNoData")
    : winnerName
      ? t("compareWinner", {
          name: winnerName,
          share: Math.round((pair.winner === "a" ? pair.aShare : pair.bShare) * 100),
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
    verdict,
  });
}

/** Two or three follow-up questions with short answers, drawn from the same numbers. */
function faqsFor(ref: AnswerRef, t: T): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];

  if (ref.kind === "card" && ref.cardSlug) {
    const device = getDevice(ref.cardSlug);
    if (!device) return out;
    const stats = cardStats(ref.cardSlug);
    out.push({
      q: t("faqPciQuestion", { name: device.name }),
      a: t("faqPciAnswer", { id: device.pciId, chip: device.chip }),
    });
    out.push({
      q: t("faqGainQuestion", { name: device.name }),
      a:
        stats.best && stats.best.ratio >= MOVED_RATIO
          ? t("faqGainAnswerYes", {
              mode: stats.best.mode,
              ratio: formatRatio(stats.best.ratio),
            })
          : t("faqGainAnswerNo"),
    });
    out.push({
      q: t("faqModuleQuestion", { name: device.name }),
      a: t("faqModuleAnswer", { fork: t(`fork.${device.fork}`) }),
    });
    return out;
  }

  if (ref.kind === "mode" && ref.modeId) {
    const group = getModeGroup(ref.modeId);
    if (!group) return out;
    const stats = modeStats(ref.modeId);
    out.push({
      q: t("faqGatedQuestion", { mode: group.name }),
      a: group.gated ? t("faqGatedYes") : t("faqGatedNo"),
    });
    out.push({
      q: t("faqFlatQuestion", { mode: group.name }),
      a: t("faqFlatAnswer", {
        flat: stats.flat,
        rows: stats.rows,
        moved: stats.improved,
      }),
    });
    return out;
  }

  const [a = "", b = ""] = ref.pair ?? [];
  const pair = pairStats(a, b);
  if (!pair) return out;
  out.push({
    q: t("faqCompareQuestion", { a: pair.a.device.name, b: pair.b.device.name }),
    a: t("faqCompareAnswer", {
      a: pair.a.device.name,
      aImproved: pair.a.stats.improved,
      b: pair.b.device.name,
      bImproved: pair.b.stats.improved,
    }),
  });
  return out;
}

/** The rows behind the answer, so the prose claim is checkable on the page itself. */
function evidenceRows(ref: AnswerRef) {
  if (ref.kind === "card" && ref.cardSlug) return rowsForCard(ref.cardSlug);
  if (ref.kind === "mode" && ref.modeId) return rowsForMode(ref.modeId);
  const [a = "", b = ""] = ref.pair ?? [];
  return [...rowsForCard(a), ...rowsForCard(b)];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const ref = getAnswerRef(slug);
  if (!ref) return {};
  const t = await getTranslations({ locale, namespace: "answers" });
  return pageMeta({
    locale,
    path: `/answers/${ref.slug}`,
    title: titleFor(ref, t),
    description: directAnswer(ref, t),
  });
}

export default async function AnswerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const ref = getAnswerRef(slug);
  if (!ref) notFound();

  const t = await getTranslations("answers");
  const tBench = await getTranslations("bench");
  const title = titleFor(ref, t);
  const answer = directAnswer(ref, t);
  const faqs = faqsFor(ref, t);
  const rows = evidenceRows(ref);
  const related = relatedAnswers(ref);
  const tExplore = await getTranslations("explore");
  // scenarioQuestion reads keys from `useCases`, not from `explore`.
  const tUseCases = await getTranslations("useCases");
  /**
   * Only the scenarios whose measurement paths this answer actually covers. A card page for a
   * card measured on tensor paths links to the inference and fine-tuning scenarios; it does not
   * claim anything about quantised inference, where the same card did not move.
   */
  const scenarios = scenariosFor(ref);
  const url = `${SITE}/${locale}/answers/${ref.slug}`;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, `/answers/${ref.slug}`, title, {
                description: answer,
                type: "TechArticle",
              }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/answers" },
                { name: title, path: `/answers/${ref.slug}` },
              ]),
              ...(faqs.length > 0 ? [faqLd(url, faqs)] : []),
            ]),
          ),
        }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">GPU Unlock</Link>
        <span className="sep">/</span>
        <Link href="/answers">{t("title")}</Link>
        <span className="sep">/</span>
        <span aria-current="page">{title}</span>
      </nav>

      <h1>{title}</h1>
      {/* The short answer sits in the first paragraph, unburied, because that is the block a
          summariser extracts. Everything below it is the evidence for it. */}
      <p className="page-intro answer-lead">{answer}</p>

      {ref.kind === "card" && ref.cardSlug ? (
        <p className="meta">
          {t("cardMeta", {
            id: getDevice(ref.cardSlug)?.pciId ?? "",
            chip: getDevice(ref.cardSlug)?.chip ?? "",
          })}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section>
          <h2>{t("evidenceTitle")}</h2>
          <p className="meta">{t("evidenceBody", { rows: rows.length })}</p>
          <table>
            <thead>
              <tr>
                <th>{t("colCard")}</th>
                <th>{t("colMode")}</th>
                <th>{t("colStock")}</th>
                <th>{t("colUnlocked")}</th>
                <th>{t("colRatio")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.cardSlug}-${row.mode}`}>
                  <td>
                    <Link href={`/gpus/${row.cardSlug}`}>{row.card}</Link>
                  </td>
                  <td>{row.mode}</td>
                  <td>
                    {row.stock} {row.unit}
                  </td>
                  <td>{row.unlocked} {row.unit}</td>
                  <td>{formatRatio(row.ratio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {faqs.length > 0 ? (
        <section>
          <h2>{t("faqTitle")}</h2>
          {faqs.map((f) => (
            <div key={f.q} className="faq-item">
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </section>
      ) : null}

      {ref.kind === "card" && ref.cardSlug && sourceForCard(ref.cardSlug) ? (
        <section>
          <h2>{tBench("methodTitle")}</h2>
          <p className="meta">
            {t("sourceLine")}{" "}
            <a href={sourceForCard(ref.cardSlug)!} rel="noopener noreferrer">
              {sourceForCard(ref.cardSlug)}
            </a>
          </p>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section>
          <h2>{t("relatedTitle")}</h2>
          <ul className="answer-index">
            {related.map((next) => (
              <li key={next.slug}>
                <Link href={`/answers/${next.slug}`}>{titleFor(next, t)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scenarios.length > 0 ? (
        <section>
          <h2>{tExplore("useCases")}</h2>
          <p className="meta">{tExplore("useCasesBody")}</p>
          <ul className="answer-index">
            {scenarios.map((scenario) => (
              <li key={scenario.slug}>
                <Link href={`/use-cases/${scenario.slug}`}>
                  {scenarioQuestion(scenario.slug, tUseCases)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

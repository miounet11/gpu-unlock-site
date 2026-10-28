import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SCENARIOS, getScenario, modeNames } from "@/data/use-cases";
import { ANSWER_PAGES } from "@/data/answers";
import { scenarioQuestion, verdictLine } from "@/data/use-case-copy";
import { getDevice } from "@/data/devices";
import { breadcrumbLd, faqLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return SCENARIOS.map((scenario) => ({ slug: scenario.slug }));
}

type T = (key: string, values?: Record<string, string | number | Date>) => string;

/** Two follow-ups per scenario, asked in the words the scenario page already answers. */
/** The card answer page, when one was generated for that card. Not every measured card has one. */
function answerSlugFor(cardSlug: string): string | null {
  return (
    ANSWER_PAGES.find((page) => page.kind === "card" && page.cardSlug === cardSlug)?.slug ?? null
  );
}

function faqsFor(slug: string, t: T): { q: string; a: string }[] {
  if (slug === "local-llm-inference") {
    return [
      { q: t("faqLocalLlmQ1"), a: t("faqLocalLlmA1") },
      { q: t("faqLocalLlmQ2"), a: t("faqLocalLlmA2") },
    ];
  }
  if (slug === "fine-tuning") {
    return [
      { q: t("faqFineTuningQ1"), a: t("faqFineTuningA1") },
      { q: t("faqFineTuningQ2"), a: t("faqFineTuningA2") },
    ];
  }
  if (slug === "stable-diffusion") {
    return [
      { q: t("faqStableDiffusionQ1"), a: t("faqStableDiffusionA1") },
      { q: t("faqStableDiffusionQ2"), a: t("faqStableDiffusionA2") },
    ];
  }
  return [
    { q: t("faqQuantizedQ1"), a: t("faqQuantizedA1") },
    { q: t("faqQuantizedQ2"), a: t("faqQuantizedA2") },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) return {};
  const t = await getTranslations({ locale, namespace: "useCases" });
  const question = scenarioQuestion(slug, t);
  return pageMeta({
    locale,
    path: `/use-cases/${slug}`,
    title: question,
    description: verdictLine(scenario, t),
  });
}

export default async function UseCase({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const scenario = getScenario(slug);
  if (!scenario) notFound();

  const t = await getTranslations("useCases");
  const question = scenarioQuestion(slug, t);
  const verdict = verdictLine(scenario, t);
  const faqs = faqsFor(slug, t);
  const url = `${SITE}/${locale}/use-cases/${slug}`;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, `/use-cases/${slug}`, question, {
                description: verdict,
                type: "TechArticle",
              }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/use-cases" },
                { name: question, path: `/use-cases/${slug}` },
              ]),
              faqLd(url, faqs),
            ]),
          ),
        }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">GPU Unlock</Link>
        <span className="sep">/</span>
        <Link href="/use-cases">{t("title")}</Link>
        <span className="sep">/</span>
        <span aria-current="page">{question}</span>
      </nav>

      <h1>{question}</h1>
      {/* The verdict is the first paragraph, with its counts inline, before any table. */}
      <p className="page-intro answer-lead">{verdict}</p>

      <section>
        <h2>{t("pathsTitle")}</h2>
        <p>{t("pathsBody")}</p>
        <ul>
          {modeNames(scenario.modes).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("evidenceTitle")}</h2>
        <p className="meta">{t("evidenceBody", { rows: scenario.rows.length })}</p>
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
            {scenario.rows.map((row) => (
              <tr key={`${row.cardSlug}-${row.mode}`}>
                <td>
                  <Link href={`/gpus/${row.cardSlug}`}>{row.card}</Link>
                </td>
                <td>{row.mode}</td>
                <td>
                  {row.stock} {row.unit}
                </td>
                <td>
                  {row.unlocked} {row.unit}
                </td>
                <td>{row.ratio.toFixed(2)}×</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{t("cardsTitle")}</h2>
        <p className="meta">{t("cardsBody", { cards: scenario.cardCount })}</p>
        <ul className="answer-index">
          {scenario.cards.map((cardSlug) => (
            <li key={cardSlug}>
              <Link href={`/gpus/${cardSlug}`}>
                {getDevice(cardSlug)?.name ?? cardSlug}
              </Link>
              {answerSlugFor(cardSlug) ? (
                <>
                  {" — "}
                  <Link href={`/answers/${answerSlugFor(cardSlug)}`}>
                    {t("cardAnswerLink")}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("faqTitle")}</h2>
        {faqs.map((f) => (
          <div key={f.q} className="faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>{t("methodTitle")}</h2>
        <p className="meta">{t("methodBody")}</p>
      </section>
    </div>
  );
}

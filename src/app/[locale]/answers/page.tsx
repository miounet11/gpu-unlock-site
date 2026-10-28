import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ANSWER_PAGES, type AnswerRef } from "@/data/answers";
import { getDevice } from "@/data/devices";
import { getModeGroup } from "@/data/modes";
import { breadcrumbLd, itemListLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "answers" });
  return pageMeta({
    locale,
    path: "/answers",
    title: t("metaTitle", { count: ANSWER_PAGES.length }),
    description: t("metaDescription"),
    keywords: [
      "does gpu unlock work",
      "gpu unlock supported cards",
      "gpu unlock benchmark gain",
      "sm speed select override",
    ],
  });
}

function cardName(ref: AnswerRef): string {
  return (ref.cardSlug && getDevice(ref.cardSlug)?.name) || "";
}

function modeName(ref: AnswerRef): string {
  return (ref.modeId && getModeGroup(ref.modeId)?.name) || "";
}

type T = (key: string, values?: Record<string, string | number | Date>) => string;

/**
 * One label per answer, built from the same data the detail page renders. Keeping this in one
 * place means the index and the page title cannot describe the same answer differently.
 */
function labelFor(ref: AnswerRef, t: T): string {
  if (ref.kind === "card") return t("questionCard", { name: cardName(ref) });
  if (ref.kind === "mode") return t("questionMode", { mode: modeName(ref) });
  const [a = "", b = ""] = ref.pair ?? [];
  return t("questionCompare", {
    a: getDevice(a)?.name ?? a,
    b: getDevice(b)?.name ?? b,
  });
}

export default async function AnswersIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("answers");
  const url = `${SITE}/${locale}/answers`;

  const groups: { title: string; refs: AnswerRef[] }[] = [
    { title: t("cardsGroup"), refs: ANSWER_PAGES.filter((r) => r.kind === "card") },
    { title: t("modesGroup"), refs: ANSWER_PAGES.filter((r) => r.kind === "mode") },
    { title: t("comparesGroup"), refs: ANSWER_PAGES.filter((r) => r.kind === "compare") },
  ];

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/answers", t("title"), { description: t("metaDescription") }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/answers" },
              ]),
              itemListLd(
                url,
                t("title"),
                ANSWER_PAGES.map((ref) => ({
                  name: labelFor(ref, t),
                  url: `${SITE}/${locale}/answers/${ref.slug}`,
                })),
              ),
            ]),
          ),
        }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">GPU Unlock</Link>
        <span className="sep">/</span>
        <span aria-current="page">{t("title")}</span>
      </nav>
      <h1>{t("title")}</h1>
      <p className="page-intro">{t("lead")}</p>
      <p className="meta">
        {t("indexCount", {
          cards: groups[0].refs.length,
          modes: groups[1].refs.length,
          compares: groups[2].refs.length,
        })}
      </p>

      {groups.map((group) => (
        <section key={group.title}>
          <h2>{group.title}</h2>
          <ul className="answer-index">
            {group.refs.map((ref) => (
              <li key={ref.slug}>
                <Link href={`/answers/${ref.slug}`}>{labelFor(ref, t)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

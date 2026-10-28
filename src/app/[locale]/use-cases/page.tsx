import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SCENARIOS } from "@/data/use-cases";
import { scenarioQuestion, verdictLine } from "@/data/use-case-copy";
import { breadcrumbLd, itemListLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "useCases" });
  return pageMeta({
    locale,
    path: "/use-cases",
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: [
      "gpu unlock local llm",
      "gpu unlock fine tuning",
      "gpu unlock stable diffusion",
      "does gpu unlock help inference",
    ],
  });
}

export default async function UseCasesIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("useCases");
  const url = `${SITE}/${locale}/use-cases`;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/use-cases", t("title"), { description: t("metaDescription") }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/use-cases" },
              ]),
              itemListLd(
                url,
                t("title"),
                SCENARIOS.map((scenario) => ({
                  name: scenarioQuestion(scenario.slug, t),
                  url: `${SITE}/${locale}/use-cases/${scenario.slug}`,
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

      <ul className="answer-index">
        {SCENARIOS.map((scenario) => (
          <li key={scenario.slug}>
            <Link href={`/use-cases/${scenario.slug}`}>{scenarioQuestion(scenario.slug, t)}</Link>
            <p className="meta">{verdictLine(scenario, t)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

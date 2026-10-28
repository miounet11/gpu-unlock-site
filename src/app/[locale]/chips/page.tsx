import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CHIPS, FAMILIES, chipsInFamily } from "@/data/chips";
import { breadcrumbLd, itemListLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "chips" });
  return pageMeta({
    locale,
    path: "/chips",
    title: t("metaTitle", { count: CHIPS.length }),
    description: t("metaDescription"),
    keywords: ["gpu unlock by chip", "AD102 unlock", "GA102 unlock", "TU102 unlock"],
  });
}

export default async function ChipsIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("chips");
  const url = `${SITE}/${locale}/chips`;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/chips", t("title"), { description: t("metaDescription") }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/chips" },
              ]),
              itemListLd(
                url,
                t("title"),
                CHIPS.map((chip) => ({
                  name: t("question", { chip: chip.chip }),
                  url: `${SITE}/${locale}/chips/${chip.slug}`,
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

      {FAMILIES.map((family) => {
        const chips = chipsInFamily(family);
        if (chips.length === 0) return null;
        return (
          <section key={family}>
            <h2>{t(`family.${family}`)}</h2>
            <ul className="answer-index">
              {chips.map((chip) => (
                <li key={chip.slug}>
                  <Link href={`/chips/${chip.slug}`}>{t("question", { chip: chip.chip })}</Link>
                  <p className="meta">
                    {t("chipMeta", {
                      cards: chip.devices.length,
                      rows: chip.rows,
                      improved: chip.improved,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

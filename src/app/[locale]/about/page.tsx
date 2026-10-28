import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { breadcrumbLd, jsonLdGraph, organizationLd, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { REPOS, SITE } from "@/lib/site";

/**
 * The upstream repositories the site's numbers are derived from. The labels are proper names
 * (fork and owner), so they are not translated; only the prose around them is.
 */
const SOURCES = [
  { name: "Ampere", repo: "Zagitta/gpu-unlock", url: REPOS.ampere },
  { name: "Ada", repo: "JustAResearcher/gpu-unlock-ada", url: REPOS.ada },
  { name: "Turing", repo: "nlzy/turing-unlock", url: REPOS.turing },
  { name: "Usage notes", repo: "miounet11/gpu-unlock", url: REPOS.usage },
  { name: "Windows port", repo: "impacifist/Windows-GPU-UNLOCK", url: REPOS.windows },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return pageMeta({
    locale,
    path: "/about",
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: [
      "about gpu unlock",
      "gpu unlock methodology",
      "sm speed select override source",
      "nvidia fuse documentation",
    ],
  });
}

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("about");

  // The pageLd node below already owns `${SITE}/${locale}/about#page`. This node gets its own
  // id so the graph never carries two different @types under one @id, and it points back at
  // both the page it describes and the organization that publishes it.
  const aboutPage = {
    "@type": "AboutPage",
    "@id": `${SITE}/${locale}/about#about-page`,
    name: t("title"),
    description: t("metaDescription"),
    url: `${SITE}/${locale}/about`,
    isPartOf: { "@id": `${SITE}/${locale}/about#page` },
    mainEntity: { "@id": `${SITE}/#organization` },
  };

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/about", t("title"), { description: t("metaDescription") }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/about" },
              ]),
              organizationLd(),
              aboutPage,
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

      <section>
        <h2>{t("whoTitle")}</h2>
        <p>{t("whoBody")}</p>
      </section>

      <section>
        <h2>{t("methodTitle")}</h2>
        <p>{t("methodBody")}</p>
      </section>

      <section>
        <h2>{t("sourcesTitle")}</h2>
        <p>{t("sourcesBody")}</p>
        <ul>
          {SOURCES.map((source) => (
            <li key={source.repo}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.name} — {source.repo}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("limitTitle")}</h2>
        <p>{t("limitBody")}</p>
      </section>

      <section>
        <h2>{t("contactTitle")}</h2>
        <p>{t("contactBody")}</p>
      </section>
    </div>
  );
}

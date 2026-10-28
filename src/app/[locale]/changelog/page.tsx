import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BENCH_RUNS } from "@/data/benchmarks";
import { DEVICES } from "@/data/devices";
import { MODULES } from "@/data/modules";
import pins from "@/data/upstream-pins.json";
import { breadcrumbLd, itemListLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "changelog" });
  return pageMeta({
    locale,
    path: "/changelog",
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: [
      "gpu unlock changelog",
      "gpu unlock pinned versions",
      "gpu unlock data revisions",
    ],
  });
}

export default async function Changelog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("changelog");

  // Read from the pins file rather than the display strings in modules.ts: the short sha here
  // is the commit the page claims, so it has to come from the same file the build checks.
  const moduleItems = MODULES.map((m) => {
    const pin = pins.modules[m.id];
    return {
      id: m.id,
      module: m.module,
      chips: m.chips,
      version: m.version,
      repo: pin.repo,
      ref: pin.ref,
      sha: pin.commit.slice(0, 7),
    };
  });

  const chipCount = new Set(DEVICES.map((d) => d.chip)).size;
  const benchRows = BENCH_RUNS.reduce((sum, run) => sum + run.rows.length, 0);
  const benchCards = new Set(BENCH_RUNS.map((run) => run.cardSlug)).size;
  const url = `${SITE}/${locale}/changelog`;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/changelog", t("title"), { description: t("metaDescription") }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/changelog" },
              ]),
              itemListLd(
                url,
                t("title"),
                moduleItems.map((m) => ({ name: m.module, url: `${url}#${m.id}` })),
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

      <section>
        <h2>{t("modulesTitle")}</h2>
        {moduleItems.map((m) => (
          <section key={m.id} id={m.id}>
            <h3>{m.module}</h3>
            <p>{t("moduleVersion", { module: m.module, chips: m.chips, version: m.version })}</p>
            <p>{t("modulePinned", { repo: m.repo, ref: m.ref, sha: m.sha })}</p>
          </section>
        ))}
      </section>

      <section>
        <h2>{t("dataTitle")}</h2>
        <p>{t("dataBody")}</p>
        <p>{t("dataCards", { count: DEVICES.length, chips: chipCount })}</p>
        <p>{t("dataRows", { rows: benchRows, cards: benchCards })}</p>
      </section>

      <section>
        <h2>{t("lastCheckedTitle")}</h2>
        <p>{t("lastCheckedBody")}</p>
      </section>
    </div>
  );
}

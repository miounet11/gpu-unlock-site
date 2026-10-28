import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MODULES } from "@/data/modules";
import { ANSWER_PAGES, cardStats, type AnswerRef } from "@/data/answers";
import { SCENARIOS } from "@/data/use-cases";
import { scenarioQuestion } from "@/data/use-case-copy";
import { getDevice } from "@/data/devices";
import { jsonLdGraph, organizationLd, pageLd, websiteLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { REPOS, REFERENCE_SITE, SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return pageMeta({
    locale,
    path: "",
    title: t("title"),
    description: t("description"),
    keywords: [
      "gpu unlock install", "gpu_unlock.targets", "turing_unlock.targets",
      "gpu unlock initramfs", "SM speed select override module", "nvidia kernel module install",
    ],
  });
}

/**
 * Six card answers, chosen by evidence rather than by hand: the cards with the most published
 * rows first. A hub page that links to an arbitrary six of 36 card pages passes crawlers into
 * the family; linking to the six with the most measurement behind them also passes readers to
 * the pages most worth arriving at.
 */
function featuredAnswers(limit = 6): { slug: string; label: string }[] {
  return ANSWER_PAGES.filter((page): page is AnswerRef & { cardSlug: string } =>
    page.kind === "card" && Boolean(page.cardSlug),
  )
    .map((page) => ({ page, stats: cardStats(page.cardSlug) }))
    .sort(
      (a, b) =>
        b.stats.rows - a.stats.rows ||
        (b.stats.best?.ratio ?? 0) - (a.stats.best?.ratio ?? 0) ||
        a.page.slug.localeCompare(b.page.slug),
    )
    .slice(0, limit)
    .map(({ page }) => ({
      slug: page.slug,
      label: getDevice(page.cardSlug)?.name ?? page.cardSlug,
    }));
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tExplore = await getTranslations("explore");
  // scenarioQuestion reads keys from `useCases`, not from `explore`, so it takes its own binding.
  const tUseCases = await getTranslations("useCases");
  const featured = featuredAnswers();

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              organizationLd(),
              websiteLd(locale),
              pageLd(locale, "", t("title"), { description: t("description") }),
              {
                "@type": "TechArticle",
                "@id": `${SITE}/${locale}#article`,
                headline: t("h1"),
                description: t("description"),
                inLanguage: locale,
                about: ["NVIDIA GPU", "kernel module", "SM speed select override", "initramfs"],
              },
            ]),
          ),
        }}
      />

      <h1>{t("h1")}</h1>
      <p className="lead">{t("lead")}</p>

      <h2>{t("modulesTitle")}</h2>
      <p>{t("modulesIntro")}</p>
      <table className="module-table">
        <thead>
          <tr>
            <th>{t("colModule")}</th>
            <th>{t("colChips")}</th>
            <th>{t("colParam")}</th>
            <th>{t("colRepo")}</th>
            <th>{t("colInstall")}</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((m) => (
            <tr key={m.id}>
              <td>
                <code>{m.module}</code>
                <br />
                <span className="meta">{m.version}</span>
              </td>
              <td>{m.chips}</td>
              <td>
                <code>{m.parameter}</code>
              </td>
              <td>
                <a href={m.repo} rel="noopener noreferrer">
                  {m.repoName}
                </a>
              </td>
              <td>
                <a href={`${SITE}/${locale}/install#module-${m.id}`}>{m.id}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="module-notes">
        {MODULES.map((m) => (
          <li key={m.id}>
            <strong>{m.module}</strong> — {t(`modules.${m.summaryKey}`)}
          </li>
        ))}
      </ul>

      <h2>{t("quickstartTitle")}</h2>
      <p>{t("quickstartBody")}</p>
      <div className="quickstart">
        <div>
          <h3>Ampere / Ada</h3>
          <pre>
            <code>{MODULES[0].commands.join("\n")}</code>
          </pre>
        </div>
        <div>
          <h3>Turing</h3>
          <pre>
            <code>{MODULES[2].commands.join("\n")}</code>
          </pre>
        </div>
      </div>
      <p className="meta">{t("quickstartAmpere")}</p>
      <p className="meta">{t("quickstartTuring")}</p>

      <h2>{t("optInTitle")}</h2>
      <p>{t("optInBody")}</p>
      <pre>
        <code>{"# all accepted cards\ngpu_unlock.targets=all\n\n# one card, by PCI address\ngpu_unlock.targets=0000:21:00.0\n\n# RTX 20 series — a different module, a different parameter\nturing_unlock.targets=all"}</code>
      </pre>

      <h2>{t("verifyTitle")}</h2>
      <p>{t("verifyBody")}</p>
      <ol>
        <li>{t("verify1")}</li>
        <li>{t("verify2")}</li>
        <li>{t("verify3")}</li>
      </ol>

      <h2>{t("riskTitle")}</h2>
      <div className="callout danger">
        <p>{t("riskBody")}</p>
      </div>

      <h2>{tExplore("title")}</h2>
      <p>{tExplore("lead")}</p>
      <ul className="answer-index">
        {featured.map((ref) => (
          <li key={ref.slug}>
            <Link href={`/answers/${ref.slug}`}>{ref.label}</Link>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/answers">{tExplore("answersLink")}</Link>
        {" · "}
        <Link href="/gpus">{tExplore("cardsLink")}</Link>
        {" · "}
        <Link href="/benchmarks">{tExplore("benchLink")}</Link>
        {" · "}
        <Link href="/about">{tExplore("aboutLink")}</Link>
      </p>

      <h2>{tExplore("useCases")}</h2>
      <p>{tExplore("useCasesBody")}</p>
      <ul className="answer-index">
        {SCENARIOS.map((scenario) => (
          <li key={scenario.slug}>
            <Link href={`/use-cases/${scenario.slug}`}>{scenarioQuestion(scenario.slug, tUseCases)}</Link>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/use-cases">{tExplore("useCasesLink")}</Link>
      </p>

      <h2>{t("referenceTitle")}</h2>
      <p>{t("referenceBody")}</p>
      <ul>
        <li>
          <a href={REFERENCE_SITE} rel="noopener noreferrer">
            {t("referenceCards")}
          </a>
        </li>
        <li>
          <a href={REFERENCE_SITE} rel="noopener noreferrer">
            {t("referenceBench")}
          </a>
        </li>
      </ul>

      <h2>{t("upstreamTitle")}</h2>
      <p>{t("upstreamBody")}</p>
      <ul>
        <li>
          <a href={REPOS.ampere} rel="noopener noreferrer">
            Zagitta/gpu-unlock
          </a>
        </li>
        <li>
          <a href={REPOS.ada} rel="noopener noreferrer">
            JustAResearcher/gpu-unlock-ada
          </a>
        </li>
        <li>
          <a href={REPOS.turing} rel="noopener noreferrer">
            nlzy/turing-unlock
          </a>
        </li>
        <li>
          <a href={REPOS.usage} rel="noopener noreferrer">
            miounet11/gpu-unlock
          </a>
        </li>
      </ul>
    </div>
  );
}

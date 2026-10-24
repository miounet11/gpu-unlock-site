import { getTranslations, setRequestLocale } from "next-intl/server";
import { MODULES } from "@/data/modules";
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

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

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

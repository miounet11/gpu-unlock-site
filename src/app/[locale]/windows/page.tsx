import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  WINDOWS_ASSETS,
  WINDOWS_BENCH,
  WINDOWS_LIMIT_KEYS,
  WINDOWS_PACKAGE,
  WINDOWS_PROFILE,
  WINDOWS_ROUTES,
  readInstallerSha256,
} from "@/data/windows";
import { breadcrumbLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { REPOS, SITE } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "windows" });
  return pageMeta({
    locale,
    path: "/windows",
    title: t("title"),
    description: t("description"),
    keywords: [
      "GPU unlock Windows", "RTX 3090 unlock Windows", "UEFI GPU unlock",
      "Windows-GPU-UNLOCK", "resizable BAR unlock", "gpu unlock without Linux",
    ],
  });
}

export default async function Windows({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("windows");
  const installerSha256 = readInstallerSha256();

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/windows", t("title"), {
                description: t("description"),
                type: "TechArticle",
              }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/windows" },
              ]),
              {
                "@type": "SoftwareApplication",
                name: "GPU Unlock for Windows",
                applicationCategory: "UtilitiesApplication",
                operatingSystem: "Windows 11",
                softwareVersion: WINDOWS_PACKAGE.version,
                isAccessibleForFree: true,
                downloadUrl: `${SITE}${WINDOWS_PACKAGE.downloadPath}`,
                license: `${REPOS.windows}/blob/v${WINDOWS_PACKAGE.version}/LICENSE`,
                sameAs: REPOS.windows,
              },
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
      <p className="page-intro">{t("description")}</p>
      <p className="lead">{t("lead")}</p>

      <section id="package">
        <h2>{t("packageTitle")}</h2>
        <p>{t("packageBody")}</p>
        <p>
          {installerSha256 ? (
            <a className="download-button" href={WINDOWS_PACKAGE.downloadPath} download>
              {t("download")} — {WINDOWS_PACKAGE.fileName}
            </a>
          ) : (
            // No artifact in public/downloads: offering the link anyway would be a 404 on a
            // page whose whole point is that checksum. The build command is the honest answer.
            <code>{WINDOWS_PACKAGE.buildCommand}</code>
          )}
        </p>
        <table>
          <tbody>
            <tr>
              <th scope="row">{t("packageVersion")}</th>
              <td>
                <code>v{WINDOWS_PACKAGE.version}</code> ({WINDOWS_PACKAGE.sourceCommit.slice(0, 12)})
              </td>
            </tr>
            <tr>
              <th scope="row">{t("packageInstallerChecksum")}</th>
              <td>
                {installerSha256 ? (
                  <code>{installerSha256}</code>
                ) : (
                  <code>{WINDOWS_PACKAGE.buildCommand}</code>
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">{t("packageChecksum")}</th>
              <td>
                <code>{WINDOWS_PACKAGE.sourceSha256}</code>
              </td>
            </tr>
            <tr>
              <th scope="row">{t("packageSource")}</th>
              <td>
                <a href={`${REPOS.windows}/releases/tag/v${WINDOWS_PACKAGE.version}`} rel="noopener noreferrer">
                  impacifist/Windows-GPU-UNLOCK v{WINDOWS_PACKAGE.version}
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        {installerSha256 ? (
          <p className="meta">
            <a href={`${WINDOWS_PACKAGE.downloadPath}.sha256`} download>
              {t("installerChecksumLink")}
            </a>
          </p>
        ) : null}
        <div className="callout danger">
          <p>{t("packageNote")}</p>
        </div>
      </section>

      <section id="routes">
        <h2>{t("routesTitle")}</h2>
        <p>{t("routesIntro")}</p>
        {WINDOWS_ROUTES.map((route) => (
          <section key={route.id} id={`route-${route.id}`}>
            <h3>{t(`routes.${route.id}.h`)}</h3>
            <p>{t(`routes.${route.id}.b`)}</p>
            {route.code ? (
              <pre>
                <code>{route.code}</code>
              </pre>
            ) : null}
          </section>
        ))}
      </section>

      <section id="assets">
        <h2>{t("assetsTitle")}</h2>
        <p>{t("assetsBody")}</p>
        <ul className="gpu-list">
          {WINDOWS_ASSETS.map((asset) => (
            <li key={asset}>
              <span className="name">{asset}</span>
            </li>
          ))}
        </ul>
        <p className="meta">{t("assetsNote")}</p>
      </section>

      <section id="profile">
        <h2>{t("profileTitle")}</h2>
        <p>{t("profileIntro")}</p>
        <table>
          <tbody>
            {WINDOWS_PROFILE.map((row) => (
              <tr key={row.key}>
                <th scope="row">{t(`labels.${row.key}`)}</th>
                <td>
                  <code>{row.value}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="bench">
        <h2>{t("benchTitle")}</h2>
        <p>{t("benchIntro")}</p>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("benchCard")}</th>
              <th scope="col">{t("benchBefore")}</th>
              <th scope="col">{t("benchAfter")}</th>
              <th scope="col">{t("benchDelta")}</th>
            </tr>
          </thead>
          <tbody>
            {WINDOWS_BENCH.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.key.toUpperCase()}</th>
                <td>{row.before}</td>
                <td>{row.after}</td>
                <td>{row.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section id="how">
        <h2>{t("howTitle")}</h2>
        <p>{t("howBody")}</p>
      </section>

      <section id="limits">
        <h2>{t("limitsTitle")}</h2>
        <div className="grid">
          {WINDOWS_LIMIT_KEYS.map((key) => (
            <div className="card" key={key}>
              <h3>{t(`limits.${key}.h`)}</h3>
              <p>{t(`limits.${key}.b`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="links">
        <h2>{t("linksTitle")}</h2>
        <ul>
          <li>
            <a href={REPOS.windows} rel="noopener noreferrer">
              {t("linkUpstream")}
            </a>
          </li>
          <li>
            <a
              href={`${REPOS.windows}/blob/v${WINDOWS_PACKAGE.version}/docs/GUIDE.en.md`}
              rel="noopener noreferrer"
            >
              {t("linkGuide")}
            </a>
          </li>
          <li>
            <a
              href={`${REPOS.windows}/blob/v${WINDOWS_PACKAGE.version}/docs/HEADLESS.en.md`}
              rel="noopener noreferrer"
            >
              {t("linkHeadless")}
            </a>
          </li>
          <li>
            <a
              href={`${REPOS.windows}/blob/v${WINDOWS_PACKAGE.version}/docs/COMPATIBILITY.en.md`}
              rel="noopener noreferrer"
            >
              {t("linkCompatibility")}
            </a>
          </li>
        </ul>
        <p className="meta">
          <Link href="/install">{t("faqLink")}</Link>
        </p>
      </section>
    </div>
  );
}

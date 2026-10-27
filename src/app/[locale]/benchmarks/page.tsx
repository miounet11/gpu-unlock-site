import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BENCH_RUNS, FP8_CUTLASS } from "@/data/benchmarks";
import { MODE_GROUPS, groupForRow, groupSlug, type ModeGroupId } from "@/data/modes";
import { breadcrumbLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";

/** Rows that actually belong to a group, counted the same way the mode page counts them. */
function rowsFor(id: ModeGroupId) {
  return BENCH_RUNS.flatMap((run) =>
    run.rows.filter((row) => groupForRow(row.mode) === id),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bench" });
  return pageMeta({
    locale,
    path: "/benchmarks",
    title: t("title"),
    description: t("description"),
    keywords: ["rtx 4090 unlock benchmark", "bf16 tensor core unlock", "gpu unlock speedup", "sm speed select benchmark"],
  });
}

export default async function Benchmarks({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("bench");
  const tm = await getTranslations("modePage");

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, "/benchmarks", t("title"), { description: t("description"), type: "CollectionPage" }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/benchmarks" },
              ]),
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

      <div className="callout">
        <p>
          <strong>{t("methodTitle")}</strong>
        </p>
        <p>{t("methodBody")}</p>
      </div>

      {/* One row per measurement path. A card table answers "what did this card gain"; this
          answers "what does this path gain across cards", which is the question a reader asks
          before buying. Only pageworthy groups are linked, because the page 404s otherwise. */}
      <section className="section">
        <h2>{tm("byModeTitle")}</h2>
        <p>{tm("byModeBody")}</p>
        <ul className="link-list">
          {MODE_GROUPS.filter((g) => g.pageworthy).map((g) => {
            const count = rowsFor(g.id).length;
            return (
              <li key={g.id}>
                <Link href={`/benchmarks/${groupSlug(g.id)}`}>{g.name}</Link>
                <span className="meta">
                  {" "}
                  · {tm("rowCount", { count })} · {g.gated ? tm("gated") : tm("ungated")}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {BENCH_RUNS.map((run) => (
        <section key={run.cardSlug}>
          <h2>
            <Link href={`/gpus/${run.cardSlug}`}>{run.card}</Link>
          </h2>
          <p className="meta">
            {t("runMeta", { chip: run.chip, sms: run.sms, driver: run.driver })}
          </p>
          <table>
            <thead>
              <tr>
                <th>{t("colMode")}</th>
                <th>{t("colStock")}</th>
                <th>{t("colUnlocked")}</th>
                <th>{t("colGain")}</th>
              </tr>
            </thead>
            <tbody>
              {run.rows.map((r) => (
                <tr key={r.mode}>
                  <td>
                    <code>{r.mode}</code>
                  </td>
                  <td>
                    {r.stock.toFixed(2)} {r.unit}
                  </td>
                  <td>
                    {r.unlocked.toFixed(2)} {r.unit}
                  </td>
                  <td>
                    <strong>{r.ratio.toFixed(2)}×</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {run.rows.some((r) => r.note) ? (
            <ul className="meta">
              {run.rows
                .filter((r) => r.note)
                .map((r) => (
                  <li key={r.mode}>
                    <code>{r.mode}</code>: {r.note}
                  </li>
                ))}
            </ul>
          ) : null}
          <p className="meta">
            <a href={run.source} rel="noopener noreferrer">
              {t("sourceLink")}
            </a>
          </p>
        </section>
      ))}

      <h2>{t("fp8Title")}</h2>
      <p>{t("fp8Body")}</p>
      <table>
        <thead>
          <tr>
            <th>{t("colRun")}</th>
            <th>{t("colMs")}</th>
            <th>{t("colGflops")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t("stock")}</td>
            <td>{FP8_CUTLASS.stock.ms.toFixed(5)}</td>
            <td>{FP8_CUTLASS.stock.gflops.toFixed(1)}</td>
          </tr>
          <tr>
            <td>{t("unlocked")}</td>
            <td>{FP8_CUTLASS.unlocked.ms.toFixed(5)}</td>
            <td>{FP8_CUTLASS.unlocked.gflops.toFixed(1)}</td>
          </tr>
        </tbody>
      </table>
      <p className="meta">
        {FP8_CUTLASS.card} · <code>{FP8_CUTLASS.kernel}</code> · {FP8_CUTLASS.ratio}×
      </p>

      <h2>{t("readTitle")}</h2>
      <p>{t("readBody")}</p>
    </div>
  );
}

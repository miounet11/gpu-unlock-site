import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BENCH_RUNS } from "@/data/benchmarks";
import {
  groupBySlug,
  groupForRow,
  groupSlug,
  pageGroups,
  type ModeGroupId,
} from "@/data/modes";
import { breadcrumbLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";

/**
 * Every measured row in one group, flattened out of its run. Not exported: Next treats any
 * extra export from a page module as a route export and rejects the module.
 */
function rowsFor(id: ModeGroupId) {
  return BENCH_RUNS.flatMap((run) =>
    run.rows
      .filter((r) => groupForRow(r.mode) === id)
      .map((r) => ({
        card: run.card,
        cardSlug: run.cardSlug,
        chip: run.chip,
        sms: run.sms,
        driver: run.driver,
        source: run.source,
        mode: r.mode,
        stock: r.stock,
        unlocked: r.unlocked,
        ratio: r.ratio,
        iters: r.iters,
        note: r.note,
      })),
  );
}

/** Which groups get a page, decided in modes.ts so the sitemap reaches the same answer. */
function groupsWithPages() {
  return pageGroups((id) => rowsFor(id).length);
}

export function generateStaticParams() {
  return groupsWithPages().map((g) => ({ mode: groupSlug(g.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; mode: string }>;
}) {
  const { locale, mode } = await params;
  const group = groupBySlug(mode);
  if (!group || !group.pageworthy) return {};
  const rows = rowsFor(group.id);
  if (rows.length === 0) return {};
  const t = await getTranslations({ locale, namespace: "modePage" });
  return pageMeta({
    locale,
    path: `/benchmarks/${groupSlug(group.id)}`,
    title: t("metaTitle", { mode: group.name }),
    description: t("metaDescription", {
      mode: group.name,
      count: rows.length,
      cards: new Set(rows.map((r) => r.cardSlug)).size,
    }),
    keywords: [group.name, "gpu unlock benchmark", "stock vs unlocked", group.unit],
  });
}

export default async function ModePage({
  params,
}: {
  params: Promise<{ locale: string; mode: string }>;
}) {
  const { locale, mode } = await params;
  setRequestLocale(locale);
  const group = groupBySlug(mode);
  if (!group || !group.pageworthy) notFound();

  const rows = rowsFor(group.id);
  if (rows.length === 0) notFound();

  const t = await getTranslations("modePage");
  const tBench = await getTranslations("bench");
  const path = `/benchmarks/${groupSlug(group.id)}`;

  // Rows are ordered by gain so the strongest result is first. A 1.00x control row ends up at
  // the bottom, which is where "this path was never limited" reads best.
  const sorted = [...rows].sort((a, b) => b.ratio - a.ratio);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const moved = rows.filter((r) => r.ratio > 1.05).length;
  const flat = rows.length - moved;
  const cards = new Set(rows.map((r) => r.cardSlug)).size;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, path, group.name, {
                description: t("metaDescription", { mode: group.name, count: rows.length, cards }),
                type: "CollectionPage",
              }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: tBench("title"), path: "/benchmarks" },
                { name: group.name, path },
              ]),
            ]),
          ),
        }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">GPU Unlock</Link>
        <span className="sep">/</span>
        <Link href="/benchmarks">{tBench("title")}</Link>
        <span className="sep">/</span>
        <span aria-current="page">{group.name}</span>
      </nav>

      <h1>{group.name}</h1>
      <p className="page-intro">{group.exercises}</p>

      <div className="callout">
        <p>
          <strong>{t("methodTitle")}</strong>
        </p>
        <p>{group.method}</p>
        <p className="meta">
          {t("gatedNote", { gated: group.gated ? t("gatedYes") : t("gatedNo") })}
        </p>
      </div>

      <section>
        <h2>{t("resultTitle")}</h2>
        <p>
          {t("resultBody", {
            count: rows.length,
            cards,
            moved,
            flat,
            best: best.card,
            bestRatio: best.ratio.toFixed(2),
          })}
        </p>
        <table>
          <thead>
            <tr>
              <th>{tBench("colMode")}</th>
              <th>{tBench("colStock")}</th>
              <th>{tBench("colUnlocked")}</th>
              <th>{tBench("colGain")}</th>
              <th>{t("colCard")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={`${r.cardSlug}-${r.mode}`}>
                <td>
                  <code>{r.mode}</code>
                  {r.note ? <span className="meta"> · {r.note}</span> : null}
                </td>
                <td className="num">{r.stock.toFixed(r.stock < 10 ? 2 : 1)}</td>
                <td className="num">
                  {r.unlocked.toFixed(r.unlocked < 10 ? 2 : 1)} {group.unit}
                </td>
                <td className="num">
                  <strong>{r.ratio.toFixed(2)}×</strong>
                </td>
                <td>
                  <Link href={`/gpus/${r.cardSlug}`}>{r.card}</Link>
                  <span className="meta">
                    {" "}
                    · {r.chip} · {t("sms", { sms: r.sms })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="meta">
          {t("flatNote", { worst: worst.card, worstRatio: worst.ratio.toFixed(2) })}
        </p>
      </section>

      <section>
        <h2>{t("readTitle")}</h2>
        <p>{tBench("readBody")}</p>
      </section>

      <section>
        <h2>{t("otherModes")}</h2>
        <ul className="link-list">
          {groupsWithPages()
            .filter((g) => g.id !== group.id)
            .map((g) => (
              <li key={g.id}>
                <Link href={`/benchmarks/${groupSlug(g.id)}`}>{g.name}</Link>
                <span className="meta"> · {rowsFor(g.id).length}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CHIPS, getChip, isMobileChip } from "@/data/chips";
import { ANSWER_PAGES, cardStats } from "@/data/answers";
import type { DeviceStatus } from "@/data/devices";
import { breadcrumbLd, faqLd, jsonLdGraph, pageLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return CHIPS.map((chip) => ({ slug: chip.slug }));
}

type T = (key: string, values?: Record<string, string | number | Date>) => string;

const STATUSES: DeviceStatus[] = ["measured", "reported", "partial", "untested", "unsupported"];

/**
 * The direct answer, before any table. A chip with no measurements says so in the first
 * sentence rather than in a footnote, because that is the sentence a reader or an assistant
 * takes away.
 */
function directAnswer(
  chip: NonNullable<ReturnType<typeof getChip>>,
  t: T,
): string {
  if (chip.rows === 0) {
    return t("answerNoRows", { chip: chip.chip, cards: chip.devices.length });
  }
  if (chip.rows === chip.improved) {
    return t("answerAllMoved", {
      chip: chip.chip,
      rows: chip.rows,
      improved: chip.improved,
      cards: chip.devices.length,
    });
  }
  return t("answerMixed", {
    chip: chip.chip,
    rows: chip.rows,
    improved: chip.improved,
  });
}

/** The card answer page, when one was generated for that card. */
function answerSlugFor(cardSlug: string): string | null {
  return (
    ANSWER_PAGES.find((page) => page.kind === "card" && page.cardSlug === cardSlug)?.slug ?? null
  );
}

function faqsFor(chip: NonNullable<ReturnType<typeof getChip>>, t: T): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [
    { q: t("faqChipQuestion", { chip: chip.chip }), a: t("faqChipAnswer", { chip: chip.chip }) },
    {
      q: t("faqMobileQuestion", { chip: chip.chip }),
      a: isMobileChip(chip.chip)
        ? t("faqMobileYes")
        : t("faqMobileNo", { chip: chip.chip }),
    },
  ];
  if (chip.rows === 0) {
    faqs.push({ q: t("faqNoDataQuestion"), a: t("faqNoDataAnswer", { chip: chip.chip }) });
  }
  return faqs;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const chip = getChip(slug);
  if (!chip) return {};
  const t = await getTranslations({ locale, namespace: "chips" });
  return pageMeta({
    locale,
    path: `/chips/${chip.slug}`,
    title: t("question", { chip: chip.chip }),
    description: directAnswer(chip, t),
    keywords: [`${chip.chip} gpu unlock`, `${chip.chip} unlock support`, `${chip.chip} tensor cores`],
  });
}

export default async function ChipPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const chip = getChip(slug);
  if (!chip) notFound();
  const t = await getTranslations("chips");
  const tStatus = await getTranslations("answers");
  const question = t("question", { chip: chip.chip });
  const answer = directAnswer(chip, t);
  const faqs = faqsFor(chip, t);
  const url = `${SITE}/${locale}/chips/${chip.slug}`;

  return (
    <div className="container page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdGraph([
              pageLd(locale, `/chips/${chip.slug}`, question, {
                description: answer,
                type: "TechArticle",
              }),
              breadcrumbLd(locale, [
                { name: "GPU Unlock", path: "" },
                { name: t("title"), path: "/chips" },
                { name: chip.chip, path: `/chips/${chip.slug}` },
              ]),
              ...(faqs.length > 0 ? [faqLd(url, faqs)] : []),
            ]),
          ),
        }}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">GPU Unlock</Link>
        <span className="sep">/</span>
        <Link href="/chips">{t("title")}</Link>
        <span className="sep">/</span>
        <span aria-current="page">{chip.chip}</span>
      </nav>

      <h1>{question}</h1>
      <p className="page-intro">{answer}</p>

      <section>
        <h2>{t("cardsTitle", { chip: chip.chip })}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("colCard")}</th>
              <th>{t("colPci")}</th>
              <th>{t("colStatus")}</th>
              <th>{t("colRows")}</th>
              <th>{t("colBest")}</th>
            </tr>
          </thead>
          <tbody>
            {chip.devices.map((device) => {
              const stats = cardStats(device.slug);
              return (
                <tr key={device.slug}>
                  <td>
                    <Link href={`/gpus/${device.slug}`}>{device.name}</Link>
                    {answerSlugFor(device.slug) ? (
                      <>
                        {" — "}
                        <Link href={`/answers/${answerSlugFor(device.slug)}`}>
                          {t("answerLink")}
                        </Link>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <code>
                      {device.pciId.replace(`${"10de"}:`, "")}
                    </code>
                  </td>
                  <td>{tStatus(`status.${device.status}`)}</td>
                  <td>{stats.rows}</td>
                  <td>{stats.best ? `${stats.best.ratio.toFixed(2)}×` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{t("statusTitle")}</h2>
        <ul className="answer-index">
          {STATUSES.filter((status) => chip.statusCounts[status] > 0).map((status) => (
            <li key={status}>
              {tStatus(`status.${status}`)}: {chip.statusCounts[status]}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("faqTitle")}</h2>
        {faqs.map((faq) => (
          <div key={faq.q} className="faq-item">
            <h3>{faq.q}</h3>
            <p>{faq.a}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>{t("relatedTitle")}</h2>
        <ul className="answer-index">
          {CHIPS.filter((other) => other.slug !== chip.slug)
            .slice(0, 6)
            .map((other) => (
              <li key={other.slug}>
                <Link href={`/chips/${other.slug}`}>{t("question", { chip: other.chip })}</Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

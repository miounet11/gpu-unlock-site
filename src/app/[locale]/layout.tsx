import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import SiteNav from "@/components/SiteNav";
import FooterNav from "@/components/FooterNav";
import { routing } from "@/i18n/routing";
import { SITE_NAME, REPOS, REFERENCE_SITE, SISTER_SITES } from "@/lib/site";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const nav = (messages.nav ?? {}) as Record<string, string>;
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <a className="skip-link" href="#main">
            {nav.skip ?? "Skip to content"}
          </a>
          <header className="site-header">
            <div className="inner">
              <div className="masthead">
                <Link href="/" className="brand">
                  GPU<span>Unlock</span>
                </Link>
                <LocaleSwitcher current={locale} label={nav.language ?? "Language"} />
              </div>
              <SiteNav locale={locale} />
            </div>
          </header>
          <main id="main">{children}</main>
          <footer className="site-footer">
            <div className="inner">
              <FooterNav />
              <p>
                {t.rich("footerBody", {
                  site: SITE_NAME,
                  ampere: (chunks) => <a href={REPOS.ampere} rel="noopener noreferrer">{chunks}</a>,
                  ada: (chunks) => <a href={REPOS.ada} rel="noopener noreferrer">{chunks}</a>,
                  turing: (chunks) => <a href={REPOS.turing} rel="noopener noreferrer">{chunks}</a>,
                  reference: (chunks) => (
                    <a href={REFERENCE_SITE} rel="noopener noreferrer">{chunks}</a>
                  ),
                })}
              </p>
              {/* Every site on this host links to the others from its footer, so the set is
                  symmetric rather than each pair negotiating separately. The reference site is
                  listed first because it is the closest neighbour: same subject, different
                  document. It is locale-prefixed; the rest are single-language sites. */}
              <p>
                {nav.footerSister ?? "Sister sites"}:{" "}
                {SISTER_SITES.map((site, i) => (
                  <span key={site.url}>
                    {i > 0 ? " · " : null}
                    <a href={"prefix" in site && site.prefix ? `${site.url}/${locale}` : site.url} rel="noopener noreferrer">
                      {site.name}
                    </a>
                  </span>
                ))}
              </p>
              <p className="meta">{t("footerMeta")}</p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SITE_NAME, REPOS, REFERENCE_SITE } from "@/lib/site";

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
              <Link href="/" className="brand">
                GPU<span>Unlock</span>
              </Link>
              <nav className="site-nav" aria-label={nav.label ?? "Main"}>
                <Link href="/#modules">{nav.modules ?? "Modules"}</Link>
                <Link href="/install">{nav.install ?? "Install"}</Link>
                <Link href="/windows">{nav.windows ?? "Windows"}</Link>
                <Link href="/faq">{nav.faq ?? "FAQ"}</Link>
                {/* The card list and the measurements are the reference site's job. Linking out
                    keeps one copy of that content instead of two nearly identical ones. */}
                <a href={`${REFERENCE_SITE}/${locale}`} rel="noopener noreferrer">
                  {nav.reference ?? "Card reference"}
                </a>
                <a href={REPOS.usage} rel="noopener noreferrer">
                  GitHub
                </a>
              </nav>
            </div>
          </header>
          <main id="main">{children}</main>
          <footer className="site-footer">
            <div className="inner">
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
              {/* The reference site already links here from its footer. Naming it in a
                  labelled group keeps the pair symmetric instead of one-sided. */}
              <p>
                {nav.footerSister ?? "Sister site"}:{" "}
                <a href={`${REFERENCE_SITE}/${locale}`} rel="noopener noreferrer">
                  {REFERENCE_SITE.replace(/^https?:\/\//, "")}
                </a>{" "}
                — {nav.footerSisterBody ?? "accepted device IDs and same-card measurements"}
              </p>
              <p className="meta">{t("footerMeta")}</p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

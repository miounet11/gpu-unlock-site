import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
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
                {SITE_NAME} installs three upstream modules:{" "}
                <a href={REPOS.ampere} rel="noopener noreferrer">
                  Zagitta/gpu-unlock
                </a>{" "}
                (Ampere),{" "}
                <a href={REPOS.ada} rel="noopener noreferrer">
                  JustAResearcher/gpu-unlock-ada
                </a>{" "}
                (Ada) and{" "}
                <a href={REPOS.turing} rel="noopener noreferrer">
                  nlzy/turing-unlock
                </a>{" "}
                (Turing). Which cards they accept, and what was measured on the same card, is
                recorded on the{" "}
                <a href={REFERENCE_SITE} rel="noopener noreferrer">
                  card reference
                </a>
                .
              </p>
              <p className="meta">
                Source available under GPL-2.0-only. NVIDIA firmware remains under its own terms.
                Not affiliated with NVIDIA.
              </p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

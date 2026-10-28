"use client";

import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { locales } from "@/i18n/routing";

/**
 * Language switcher.
 *
 * Seven locales are served, and until now the only way to reach the other six was to edit the
 * URL by hand. `usePathname` from the navigation helper returns the path *without* the locale
 * prefix, so the same page is linked in each language rather than dumping the reader on the
 * home page.
 */
export default function LocaleSwitcher({
  current,
  label,
}: {
  current: string;
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav className="lang-switch" aria-label={label}>
      {locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          hrefLang={locale}
          aria-current={locale === current ? "true" : undefined}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}

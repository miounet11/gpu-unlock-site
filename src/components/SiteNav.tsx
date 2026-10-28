"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { SECTIONS } from "@/lib/sections";
import { REFERENCE_SITE, REPOS } from "@/lib/site";

/**
 * Main section nav.
 *
 * The header lists thirteen destinations, and until now none of them was marked as the current
 * page, so a reader had no visual or assistive cue about where they were. `usePathname` returns
 * the path without the locale prefix, which is what a section link has to be compared against.
 */

export default function SiteNav({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  // A section is current for its own page and for everything nested under it, so a chip detail
  // page still marks "Chips".
  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="site-nav" aria-label={t("label")}>
      <Link href="/#modules">{t("modules")}</Link>
      {SECTIONS.map(({ href, key }) => (
        <Link key={href} href={href} aria-current={isCurrent(href) ? "page" : undefined}>
          {t(key)}
        </Link>
      ))}
      {/* The reference site still covers cards independently; the label says it is a different
          site rather than a section of this one. */}
      <a href={`${REFERENCE_SITE}/${locale}`} rel="noopener noreferrer">
        {t("reference")}
      </a>
      <a href={REPOS.usage} rel="noopener noreferrer">
        GitHub
      </a>
    </nav>
  );
}

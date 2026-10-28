import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SECTIONS } from "@/lib/sections";

/**
 * Footer navigation.
 *
 * The header is sticky, but a reader who finishes a long answer page has still scrolled well past
 * it, and the footer used to be prose only. This repeats the sections in two columns with their
 * labels, so the bottom of every page is a way out rather than a dead end.
 */
export default async function FooterNav() {
  const t = await getTranslations("nav");
  return (
    <nav className="footer-nav" aria-label={t("footerNav")}>
      <ul className="footer-nav-list">
        {SECTIONS.map(({ href, key }) => (
          <li key={href}>
            <Link href={href}>{t(key)}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="container page">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <ul>
        <li><Link href="/">{t("home")}</Link></li>
        <li><Link href="/gpus">{t("cards")}</Link></li>
        <li><Link href="/benchmarks">{t("benchmarks")}</Link></li>
        <li><Link href="/install">{t("install")}</Link></li>
      </ul>
    </div>
  );
}

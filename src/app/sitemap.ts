import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"] as const;

// Only the pages this site owns. The card list and the measurements live on the reference
// site and redirect there, so listing them here would point crawlers at a redirect.
const PATHS = ["", "/install", "/windows", "/faq"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return LOCALES.flatMap((locale) =>
    PATHS.map((path) => ({
      url: `${SITE}/${locale}${path}`,
      lastModified,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${SITE}/${l}${path}`]),
        ),
      },
    })),
  );
}

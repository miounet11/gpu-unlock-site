import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"] as const;

// Only the pages this site owns. The card list and the measurements live on the reference
// site and redirect there, so listing them here would point crawlers at a redirect.
const PATHS = ["", "/install", "/windows", "/faq"];

export default function sitemap(): MetadataRoute.Sitemap {
  // No lastModified on purpose. `new Date()` here would stamp every URL with the build time,
  // so a rebuild with no content change claims all 28 pages changed that day. Crawlers learn
  // to distrust lastmod when it stops tracking the content, and then ignore it site-wide —
  // which is worse than the field being absent. changeFrequency below still says how often
  // each hub is worth revisiting, and that claim is not time-sensitive.
  return LOCALES.flatMap((locale) =>
    PATHS.map((path) => ({
      url: `${SITE}/${locale}${path}`,
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

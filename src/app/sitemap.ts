import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { DEVICES } from "@/data/devices";
import { BENCH_RUNS } from "@/data/benchmarks";
import { groupForRow, groupSlug, pageGroups } from "@/data/modes";

const LOCALES = ["en", "zh", "ja", "de", "fr", "es", "pt"] as const;

// Hubs built from a fixed list. Detail pages are appended below from the data they render,
// because a hand-kept list here would drift the first time a card or a mode is added.
const PATHS = ["", "/install", "/windows", "/gpus", "/benchmarks", "/faq"];

// Card pages change when the upstream evidence does, which is not on a schedule.
const CARD_PATHS = DEVICES.map((device) => `/gpus/${device.slug}`);

// The same predicate the mode page uses to decide what it renders. Anything else would let
// this list and that page disagree, and the sitemap would publish a URL that 404s.
const MODE_PATHS = pageGroups(
  (id) =>
    BENCH_RUNS.flatMap((run) => run.rows).filter((row) => groupForRow(row.mode) === id)
      .length,
).map((g) => `/benchmarks/${groupSlug(g.id)}`);

export default function sitemap(): MetadataRoute.Sitemap {
  // No lastModified on purpose. `new Date()` here would stamp every URL with the build time,
  // so a rebuild with no content change claims every page changed that day. Crawlers learn
  // to distrust lastmod when it stops tracking the content, and then ignore it site-wide —
  // which is worse than the field being absent. changeFrequency below still says how often
  // each hub is worth revisiting, and that claim is not time-sensitive.
  return LOCALES.flatMap((locale) =>
    [...PATHS, ...MODE_PATHS, ...CARD_PATHS].map((path) => ({
      url: `${SITE}/${locale}${path}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("/gpus") ? 0.7 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${SITE}/${l}${path}`]),
        ),
      },
    })),
  );
}

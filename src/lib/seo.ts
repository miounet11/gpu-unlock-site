import type { Metadata } from "next";
import { SITE, SITE_NAME } from "./site";

export function pageMeta(opts: {
  locale: string;
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}): Metadata {
  const url = `${SITE}/${opts.locale}${opts.path}`;
  // src/app/opengraph-image.tsx builds one 1200×630 card for the whole site. Next only
  // injects file-based metadata into a segment that does not override `openGraph`, and every
  // page here sets its own title and description — so the image has to be named explicitly or
  // it is built and then never linked.
  const image = `${SITE}/opengraph-image`;
  const imageAlt = "GPU Unlock — NVIDIA SM speed-select override documentation";

  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(
          ["en", "zh", "ja", "de", "fr", "es", "pt"].map((l) => [
            l,
            `${SITE}/${l}${opts.path}`,
          ]),
        ),
        // For a path that exists in seven languages, x-default tells a crawler which one to
        // serve to a reader whose language is none of them. Without it the choice is a guess.
        "x-default": `${SITE}/en${opts.path}`,
      },
    },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      locale: opts.locale,
      images: [{ url: image, width: 1200, height: 630, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}

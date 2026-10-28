import { SITE, SITE_NAME } from "./site";

export const ORG_ID = `${SITE}/#organization`;
export const SITE_ID = `${SITE}/#website`;

export function nodeId(url: string, kind: string): string {
  return `${url}#${kind}`;
}

/**
 * One @graph per page. Every page carries the organization and the website so the `@id` links
 * resolve without a second request, which is what makes the graph readable by an answer engine.
 */
export function jsonLdGraph(nodes: object[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE,
    description:
      "Documentation for the GPU Unlock NVIDIA kernel modules, covering the Ampere, Ada and Turing forks.",
    sameAs: [
      "https://github.com/Zagitta/gpu-unlock",
      "https://github.com/JustAResearcher/gpu-unlock-ada",
      "https://github.com/nlzy/turing-unlock",
      "https://github.com/miounet11/gpu-unlock",
    ],
  };
}

export function websiteLd(locale: string) {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: SITE,
    name: SITE_NAME,
    inLanguage: locale,
    publisher: { "@id": ORG_ID },
  };
}

export function pageLd(
  locale: string,
  path: string,
  name: string,
  opts: { description?: string; type?: string } = {},
) {
  const url = `${SITE}/${locale}${path}`;
  return {
    "@type": opts.type ?? "WebPage",
    "@id": nodeId(url, "page"),
    url,
    name,
    ...(opts.description ? { description: opts.description } : {}),
    inLanguage: locale,
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbLd(
  locale: string,
  trail: { name: string; path: string }[],
) {
  return {
    "@type": "BreadcrumbList",
    "@id": nodeId(`${SITE}/${locale}${trail[trail.length - 1].path}`, "breadcrumb"),
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE}/${locale}${item.path}`,
    })),
  };
}

/**
 * The question-and-answer shape an answer engine reads. Kept separate from the page node so a
 * page can carry both: the article says what the page is, this says what it answers.
 */
export function faqLd(url: string, faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": nodeId(url, "faq"),
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** One list node for a hub page, so the set of answers is visible without parsing the HTML. */
export function itemListLd(
  url: string,
  name: string,
  items: { name: string; url: string }[],
) {
  return {
    "@type": "ItemList",
    "@id": nodeId(url, "list"),
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

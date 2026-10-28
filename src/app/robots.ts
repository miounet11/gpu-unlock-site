import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Named groups for the crawlers this site wants, ahead of the catch-all.
 *
 * `*` already allows everyone, but a crawler that finds no group naming it has no explicit grant and
 * several operators treat that as "unspecified" rather than "welcome". Naming them also documents the
 * intent, so a later tightening of the catch-all cannot silently cut off the answer engines.
 *
 * Search/answer crawlers (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-User) are the ones that
 * cite with a link. Training crawlers are allowed too: the module sources and measurements here are
 * already public, so opting out would cost citations without hiding anything.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot",
  "Applebot-Extended",
  "Amazonbot",
  "CCBot",
  "Bytespider",
  "YouBot",
  "cohere-ai",
  "meta-externalagent",
  "Diffbot",
  "AI2Bot",
  "Timpibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

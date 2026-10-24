import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

/**
 * Public origin used for the one redirect this site has to construct itself.
 *
 * Next's standalone server derives `request.nextUrl` from the address it listens on, so
 * next-intl answered `/` with `Location: https://localhost:3200/en` — unusable behind
 * nginx. Middleware also cannot answer with a path-relative Location here: Next 15.5
 * parses the outgoing value as an absolute URL and throws `ERR_INVALID_URL` on `/en`.
 * An explicit public origin is the one form that works in both places.
 */
const PUBLIC_ORIGIN = process.env.SITE_URL || "https://gpu-unlock.com";

/**
 * Pick the first supported locale the browser asked for. Order follows the q-values,
 * which browsers already emit in preference order; anything unmatched falls back to the
 * routing default. A `NEXT_LOCALE` cookie wins over the header so a visitor who has
 * switched language once stays switched.
 */
function negotiateLocale(request: NextRequest): string {
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (locales as readonly string[]).includes(cookie)) return cookie;

  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    const match = (locales as readonly string[]).find((l) => l === primary);
    if (match) return match;
  }
  return routing.defaultLocale;
}

export default function middleware(request: NextRequest) {
  // Only the bare root is handled here; every prefixed path stays with next-intl.
  if (request.nextUrl.pathname === "/") {
    const target = new URL(`/${negotiateLocale(request)}`, PUBLIC_ORIGIN);
    return NextResponse.redirect(target, 307);
  }
  return handleI18n(request);
}

export const config = {
  matcher: ["/", "/(en|zh|ja|de|fr|es|pt)/:path*"],
};

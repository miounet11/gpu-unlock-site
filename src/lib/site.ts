export const SITE = "https://gpu-unlock.com";
export const SITE_NAME = "GPU Unlock";

/**
 * The companion reference site. It owns the card list, the accepted device IDs and the
 * same-card measurements; this site owns the build, the boot order and the checks. The two
 * are deliberately different documents, so a reader who needs "does my card work" follows
 * the link instead of finding the same table twice.
 */
export const REFERENCE_SITE = "https://gpuunlock.com";

export const REPOS = {
  ampere: "https://github.com/Zagitta/gpu-unlock",
  ada: "https://github.com/JustAResearcher/gpu-unlock-ada",
  // Turing (RTX 20 series). Separate module, separate kernel parameter.
  turing: "https://github.com/nlzy/turing-unlock",
  // The public repo the site's own usage notes live in.
  usage: "https://github.com/miounet11/gpu-unlock",
} as const;

export function absUrl(path: string): string {
  return `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Locale-prefixed absolute URL. Every locale is served with a prefix, including English. */
export function localeUrl(locale: string, path = ""): string {
  return absUrl(`/${locale}${path}`);
}

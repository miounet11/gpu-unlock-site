export const SITE = "https://gpu-unlock.com";
export const SITE_NAME = "GPU Unlock";

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

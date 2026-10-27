export const SITE = "https://gpu-unlock.com";
export const SITE_NAME = "GPU Unlock";

/**
 * The companion reference site. It owns the card list, the accepted device IDs and the
 * same-card measurements; this site owns the build, the boot order and the checks. The two
 * are deliberately different documents, so a reader who needs "does my card work" follows
 * the link instead of finding the same table twice.
 */
export const REFERENCE_SITE = "https://gpuunlock.com";

/**
 * The other sites on this host, linked from the footer in both directions. Each one serves
 * real pages to readers — APIs and default catch-all vhosts are deliberately not listed.
 * Adding an entry here obliges that site to link back; tests/sister-links.test.mjs checks
 * the hosts, not just the presence of a link.
 */
export const SISTER_SITES = [
  { name: "GPU Unlock Reference", url: REFERENCE_SITE, prefix: true },
  { name: "Android 去广告", url: "https://www.androidadcleaner.com" },
  { name: "CleanYourTV", url: "https://www.cleanyourtv.cc" },
  { name: "Strata", url: "https://www.stratat.com" },
  // www, not the bare apex: jevcode.ai has no A record, so the apex link fails to resolve.
  { name: "JevCode", url: "https://www.jevcode.ai" },
] as const;

export const REPOS = {
  ampere: "https://github.com/Zagitta/gpu-unlock",
  ada: "https://github.com/JustAResearcher/gpu-unlock-ada",
  // Turing (RTX 20 series). Separate module, separate kernel parameter.
  turing: "https://github.com/nlzy/turing-unlock",
  // The public repo the site's own usage notes live in.
  usage: "https://github.com/miounet11/gpu-unlock",
  // Windows-side port: UEFI unlock that hands the card back to Windows without rebooting
  // into Linux. Separate project, separate boot routes; see /windows.
  windows: "https://github.com/impacifist/Windows-GPU-UNLOCK",
} as const;

export function absUrl(path: string): string {
  return `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Locale-prefixed absolute URL. Every locale is served with a prefix, including English. */
export function localeUrl(locale: string, path = ""): string {
  return absUrl(`/${locale}${path}`);
}

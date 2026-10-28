/**
 * The section list, in one place.
 *
 * Both the header and the footer render these destinations. Keeping the array here means a new
 * section is added once instead of being added to the header and forgotten in the footer.
 */
export const SECTIONS = [
  { href: "/install", key: "install" },
  { href: "/windows", key: "windows" },
  { href: "/gpus", key: "cards" },
  { href: "/chips", key: "chips" },
  { href: "/benchmarks", key: "benchmarks" },
  { href: "/answers", key: "answers" },
  { href: "/use-cases", key: "useCases" },
  { href: "/faq", key: "faq" },
  { href: "/about", key: "about" },
  { href: "/changelog", key: "changelog" },
] as const;

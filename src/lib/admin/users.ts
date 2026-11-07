// User report: how much traffic was actually people, and where they came from.
//
// The number this report is most likely to be quoted for — unique users — is the one the logs
// cannot give. An access log has IP addresses, and a busy IP is not a person. So the count is
// returned as `inferred`, with the basis spelled out, and the excluded traffic is reported
// alongside it so a reader can see how much of the raw number was not human.

import { classifyTraffic, localeOf, refererHost, type LogRecord } from "./logs.ts";
import type { LogSource } from "./source.ts";
import type { Metric, UserReport } from "./types.ts";
import { countDays } from "./crawler.ts";

export interface UsersOptions {
  site: string;
  /** Hosts that belong to this site; their referers are internal navigation, not entries. */
  ownHosts: string[];
}

export async function buildUsersReport(
  source: LogSource,
  window: { from: Date | null; to: Date | null },
  opts: UsersOptions,
): Promise<UserReport> {
  const records: LogRecord[] = await source.readWindow(window.from, window.to);
  const warnings = [...source.warnings()];
  const own = new Set(opts.ownHosts.map((h) => h.replace(/^www\./, "").toLowerCase()));

  const ips = new Set<string>();
  const excluded = new Map<string, number>();
  const external = new Map<string, number>();
  const locales = new Map<string, number>();
  const statusClasses = new Map<string, number>();
  let counted = 0;
  let direct = 0;
  let internal = 0;
  let externalTotal = 0;

  for (const rec of records) {
    const kind = classifyTraffic(rec);
    if (kind.kind !== "human") {
      excluded.set(kind.label, (excluded.get(kind.label) ?? 0) + 1);
      continue;
    }

    counted++;
    if (rec.ip) ips.add(rec.ip);

    const cls = `${Math.floor(rec.status / 100)}xx`;
    statusClasses.set(cls, (statusClasses.get(cls) ?? 0) + 1);

    const locale = localeOf(rec.uri);
    if (locale) locales.set(locale, (locales.get(locale) ?? 0) + 1);

    const host = refererHost(rec.referer);
    if (!host) {
      direct++;
      continue;
    }
    const bare = host.replace(/^www\./, "");
    if (own.has(bare) || [...own].some((h) => bare.endsWith(`.${h}`))) {
      internal++;
      continue;
    }
    externalTotal++;
    external.set(bare, (external.get(bare) ?? 0) + 1);
  }

  // Measured: this is a count of log lines that survived the filters, and the filters are
  // listed below. What is inferred is the step from lines to people (see uniqueIps).
  const requests: Metric = {
    value: counted,
    confidence: "measured",
    basis:
      "log lines not matched to any crawler token, own-script UA, disguised-crawler address " +
      "block, or scanner path — a per-request count, not per-session",
  };
  const uniqueIps: Metric = {
    value: ips.size,
    confidence: "inferred",
    basis: "distinct source IP addresses among those lines; one person on several addresses counts more than once, and a shared address counts once",
  };

  return {
    generatedAt: new Date().toISOString(),
    window: {
      from: window.from?.toISOString() ?? null,
      to: window.to?.toISOString() ?? null,
      daysCovered: countDays(records),
    },
    warnings,
    site: opts.site,
    requests,
    uniqueIps,
    entrySources: {
      direct,
      external: externalTotal,
      internal,
      externalTop: [...external.entries()]
        .map(([host, visits]) => ({ host, visits }))
        // Ties break on host: a map's insertion order follows whichever log file was read
        // first, which makes the same window produce a different list on a rotation boundary.
        .sort((a, b) => b.visits - a.visits || a.host.localeCompare(b.host))
        .slice(0, 15),
    },
    locales: [...locales.entries()]
      .map(([locale, requests2]) => ({ locale, requests: requests2 }))
      .sort((a, b) => b.requests - a.requests),
    excludedTraffic: [...excluded.entries()]
      .map(([reason, r]) => ({ reason, requests: r }))
      .sort((a, b) => b.requests - a.requests),
    statusClasses: [...statusClasses.entries()]
      .map(([status, r]) => ({ status, requests: r }))
      .sort((a, b) => a.status.localeCompare(b.status)),
  };
}

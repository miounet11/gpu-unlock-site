// Shared shapes for the four read-only admin reports.
//
// Every number these reports return is one of two kinds, and the distinction is the point of
// this module: `measured` came out of a log line, a git command, or an HTTP response we
// actually made, while `inferred` is a conclusion drawn from those (a request count standing in
// for a user count, a crawl standing in for an index). Search engines do not publish an index
// count to us, so anything that would mean "indexed pages" has to be labelled inferred and say
// what it actually measures.

export type Confidence = "measured" | "inferred";

export interface Metric<T = number> {
  value: T;
  confidence: Confidence;
  /** What was actually counted. Read this before quoting `value`. */
  basis: string;
}

export interface ReportWindow {
  from: string | null;
  to: string | null;
  /** Days of log actually found for this window. */
  daysCovered: number;
}

export interface AdminReportBase {
  generatedAt: string;
  window: ReportWindow;
  /** Anything that could not be read, so a partial report never looks complete. */
  warnings: string[];
}

export interface CrawlerRanking {
  crawler: string;
  requests: number;
  share: number;
  lastSeen: string | null;
}

export interface CrawlerReport extends AdminReportBase {
  site: string;
  totalRequests: Metric;
  botRequests: Metric;
  botShare: Metric;
  humanRequests: Metric;
  ranking: CrawlerRanking[];
  sitemapCoverage: {
    urls: number;
    crawledByGoogle: Metric;
    crawledByBing: Metric;
    crawledByAnyBot: Metric;
    neverCrawled: string[];
  } | null;
}

export interface IndexingReport extends AdminReportBase {
  site: string;
  sitemap: {
    url: string;
    reachable: boolean;
    urlCount: number | null;
  };
  robots: {
    url: string;
    reachable: boolean;
    sitemapDirectives: number;
  };
  searchReferrals: Array<{ engine: string; visits: number }>;
  /** Always null: no index count is available from logs. Present so callers cannot invent one. */
  indexedPages: null;
  indexedPagesNote: string;
}

export interface UserReport extends AdminReportBase {
  site: string;
  requests: Metric;
  uniqueIps: Metric;
  entrySources: {
    direct: number;
    external: number;
    internal: number;
    externalTop: Array<{ host: string; visits: number }>;
  };
  locales: Array<{ locale: string; requests: number }>;
  excludedTraffic: Array<{ reason: string; requests: number }>;
  statusClasses: Array<{ status: string; requests: number }>;
}

export interface UpdatesReport extends AdminReportBase {
  repo: {
    branch: string | null;
    head: string | null;
    headDate: string | null;
    headSubject: string | null;
    aheadOfOrigin: number | null;
    originHead: string | null;
    uncommittedFiles: number | null;
  };
  deployed: {
    buildId: string | null;
    builtAt: string | null;
    /** True when the live tree's BUILD_ID differs from the checked-out commit's build. */
    matchesHead: boolean | null;
  };
  patrol: {
    lastRun: string | null;
    lastStatus: "ok" | "failed" | null;
    consecutiveOk: number | null;
  };
  /** Set when the host step could not run at all, e.g. no ssh or no repo on this machine. */
  sourceAvailable: boolean;
}

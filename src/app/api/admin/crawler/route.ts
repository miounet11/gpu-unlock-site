import { buildCrawlerReport } from "@/lib/admin/crawler";
import { badRequest, json, parseWindow, sourceFromEnv, unavailable } from "@/lib/admin/http";

// Always dynamic: these reports read live logs and must never be baked into a static build.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const parsed = parseWindow(params);
  if (!parsed.ok || !parsed.window) return badRequest(parsed.error ?? "invalid window");

  const source = sourceFromEnv("gpu-unlock");
  try {
    const report = await buildCrawlerReport(source, parsed.window, {
      site: "gpu-unlock.com",
      sitemapUrl: process.env.GPU_UNLOCK_SITEMAP_URL ?? "https://gpu-unlock.com/sitemap.xml",
    });
    // An unreadable log is a failed report. Returning zeros would read as "no crawlers came".
    if (report.totalRequests.value === 0 && report.warnings.length > 0) {
      return unavailable("no traffic data could be read", report.warnings);
    }
    return json(report);
  } catch (err) {
    return json({ error: `crawler report failed: ${(err as Error).message}` }, 500);
  }
}

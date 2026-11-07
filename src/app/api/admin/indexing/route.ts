import { buildIndexingReport } from "@/lib/admin/indexing";
import { badRequest, json, parseWindow, sourceFromEnv } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const parsed = parseWindow(params);
  if (!parsed.ok || !parsed.window) return badRequest(parsed.error ?? "invalid window");

  const base = process.env.GPU_UNLOCK_SITE_URL ?? "https://gpu-unlock.com";
  const source = sourceFromEnv("gpu-unlock");
  try {
    // Unlike the other reports this one stays a 200 when logs are unreadable: the sitemap and
    // robots facts are still true and still useful, and `warnings` says the referral counts
    // are missing. Refusing the whole document would throw away what did work.
    const report = await buildIndexingReport(source, parsed.window, {
      site: "gpu-unlock.com",
      sitemapUrl: `${base}/sitemap.xml`,
      robotsUrl: `${base}/robots.txt`,
    });
    return json(report);
  } catch (err) {
    return json({ error: `indexing report failed: ${(err as Error).message}` }, 500);
  }
}

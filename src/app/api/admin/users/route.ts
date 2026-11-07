import { buildUsersReport } from "@/lib/admin/users";
import { badRequest, json, parseWindow, sourceFromEnv, unavailable } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const parsed = parseWindow(params);
  if (!parsed.ok || !parsed.window) return badRequest(parsed.error ?? "invalid window");

  const source = sourceFromEnv("gpu-unlock");
  try {
    const report = await buildUsersReport(source, parsed.window, {
      site: "gpu-unlock.com",
      // Both hostnames serve the same site; a referer to either is internal navigation.
      ownHosts: ["gpu-unlock.com", "gpuunlock.com"],
    });
    if (report.requests.value === 0 && report.warnings.length > 0) {
      return unavailable("no traffic data could be read", report.warnings);
    }
    return json(report);
  } catch (err) {
    return json({ error: `users report failed: ${(err as Error).message}` }, 500);
  }
}

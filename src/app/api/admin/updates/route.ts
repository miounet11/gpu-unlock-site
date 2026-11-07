import { buildUpdatesReport } from "@/lib/admin/updates";
import { json } from "@/lib/admin/http";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const report = await buildUpdatesReport({
      repoDir: process.env.GPU_UNLOCK_REPO_DIR || process.cwd(),
      buildIdPath: process.env.GPU_UNLOCK_BUILD_ID_PATH,
      patrolLogPath: process.env.GPU_UNLOCK_PATROL_LOG,
    });
    return json(report);
  } catch (err) {
    return json({ error: `updates report failed: ${(err as Error).message}` }, 500);
  }
}

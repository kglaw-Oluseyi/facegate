export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { runRetentionSweeper } from "@/lib/jobs/retention-sweeper";

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return jsonErr("Unauthorized", 401);
  }

  const result = await runRetentionSweeper();
  return jsonOk(result);
}

import { auth } from "@/lib/auth";
import { jsonErr, jsonOk } from "@/lib/api-response";
import { isPlatformAdmin } from "@/lib/roles";
import { loadPlatformOverview } from "@/lib/platform-overview";

export async function GET() {
  const session = await auth();
  if (!session?.user) return jsonErr("Unauthorized", 401);
  if (!isPlatformAdmin(session)) return jsonErr("Forbidden", 403);

  const data = await loadPlatformOverview();
  return jsonOk(data);
}

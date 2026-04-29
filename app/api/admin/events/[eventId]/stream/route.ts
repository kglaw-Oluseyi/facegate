export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { computeLiveEventMetrics } from "@/lib/live-event-metrics";
import { jsonErr } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return jsonErr("Unauthorized", 401);
  }

  const { eventId } = await context.params;
  const signal = req.signal;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        const bundle = await computeLiveEventMetrics(
          eventId,
          session.user.tenantId
        );
        if (!bundle) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                data: { message: "Event not found" },
              })}\n\n`
            )
          );
          return;
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "metrics", data: bundle })}\n\n`
          )
        );
      };

      await send();
      const interval = setInterval(() => {
        void send();
      }, 5000);

      const onAbort = () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

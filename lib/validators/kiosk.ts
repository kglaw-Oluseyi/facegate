import { z } from "zod";

export const kioskAttemptBody = z.object({
  clientRequestId: z.string().uuid(),
  imageBase64: z.string().min(1),
  capturedAt: z.string().min(1),
});

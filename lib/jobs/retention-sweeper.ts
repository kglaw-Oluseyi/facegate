import { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runBiometricDeletion } from "@/lib/jobs/deletion";

export async function runRetentionSweeper(): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  const due = await prisma.event.findMany({
    where: {
      biometricRetentionUntil: { lt: new Date() },
      status: { not: EventStatus.ARCHIVED },
      deletionRuns: {
        none: {
          status: "COMPLETED",
        },
      },
    },
    select: { id: true },
  });

  for (const ev of due) {
    try {
      const result = await runBiometricDeletion(ev.id, "SYSTEM_SWEEPER");
      if (result.success) processed += 1;
      else errors.push(`${ev.id}: ${result.errors.join("; ")}`);
    } catch (e) {
      errors.push(`${ev.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { processed, errors };
}

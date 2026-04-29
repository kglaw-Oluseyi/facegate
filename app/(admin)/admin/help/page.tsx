import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { OperationsManual } from "@/components/admin/operations-manual";

export const metadata: Metadata = {
  title: "Operations Manual · FaceGate OS",
};

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg-ink">
          Operations Manual
        </h1>
        <p className="mt-1 text-sm text-fg-mist">
          Procedures, exception handling, and privacy guidance for live event
          operations.
        </p>
      </div>
      <OperationsManual />
    </div>
  );
}


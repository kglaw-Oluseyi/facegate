import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-fg-ink">Settings</h2>
        <p className="text-sm text-fg-mist">Tenant-level preferences will appear in later slices.</p>
      </div>
      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Session</CardTitle>
          <CardDescription className="text-fg-mist">You are signed in as {session.user.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-fg-mist">
          <p>
            Biometric provider mode is controlled via environment configuration and is currently set
            to mock for development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

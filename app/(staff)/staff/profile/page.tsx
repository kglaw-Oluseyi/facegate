import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffRoleBadge } from "@/components/admin/role-badge";

export default async function StaffProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg-ink">My profile</h1>
        <p className="text-sm text-fg-mist">Signed-in staff identity for this console session.</p>
      </div>
      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">{session.user.name}</CardTitle>
          <CardDescription className="text-fg-mist">{session.user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <span className="text-sm text-fg-mist">Role</span>
          <StaffRoleBadge role={session.user.role} />
        </CardContent>
      </Card>
    </div>
  );
}

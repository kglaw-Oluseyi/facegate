import Link from "next/link";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffRoleBadge } from "@/components/admin/role-badge";
import { StaffRowActions } from "@/components/admin/staff-row-actions";
import { Users } from "lucide-react";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const users = await prisma.staffUser.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg-ink">Staff</h2>
          <p className="text-sm text-fg-mist">Manage who can operate FaceGate for this tenant.</p>
        </div>
        <Button asChild className="bg-fg-gold text-fg-black hover:bg-fg-gold/90">
          <Link href="/people/new">Create Staff User</Link>
        </Button>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Team members</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-fg-mist">
              <Users className="h-10 w-10 opacity-40" />
              <p className="text-sm">No additional staff yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-fg-line hover:bg-transparent">
                  <TableHead className="text-fg-mist">Name</TableHead>
                  <TableHead className="text-fg-mist">Email</TableHead>
                  <TableHead className="text-fg-mist">Role</TableHead>
                  <TableHead className="text-fg-mist">Status</TableHead>
                  <TableHead className="text-fg-mist">Created</TableHead>
                  <TableHead className="text-right text-fg-mist">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-fg-line">
                    <TableCell className="font-medium text-fg-ink">{u.name}</TableCell>
                    <TableCell className="text-fg-mist">{u.email}</TableCell>
                    <TableCell>
                      <StaffRoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className="text-fg-mist">{u.isActive ? "Active" : "Inactive"}</TableCell>
                    <TableCell className="text-fg-mist">
                      {format(u.createdAt, "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <StaffRowActions userId={u.id} isActive={u.isActive} selfId={session.user.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/roles";
import { loadPlatformOverview } from "@/lib/platform-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function PlatformOverviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isPlatformAdmin(session)) redirect("/dashboard");

  const data = await loadPlatformOverview();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-fg-mist">
          <Link href="/dashboard" className="text-fg-gold hover:underline">
            ← Dashboard
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-fg-ink">Platform overview</h1>
        <p className="mt-1 text-sm text-fg-mist">
          Cross-tenant snapshot · biometric provider{" "}
          <span className="font-mono text-fg-ink">
            {String((data.biometricProvider as { provider?: string }).provider ?? "—")}
          </span>
        </p>
      </div>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-fg-line hover:bg-transparent">
                <TableHead className="text-fg-mist">Name</TableHead>
                <TableHead className="text-fg-mist">Slug</TableHead>
                <TableHead className="text-fg-mist text-right">Events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenants.map((t) => (
                <TableRow key={t.id} className="border-fg-line">
                  <TableCell className="text-fg-ink">{t.name}</TableCell>
                  <TableCell className="font-mono text-xs text-fg-mist">{t.slug}</TableCell>
                  <TableCell className="text-right text-fg-mist">{t.eventCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-fg-line bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-ink">Live events</CardTitle>
        </CardHeader>
        <CardContent>
          {data.liveEvents.length === 0 ? (
            <p className="text-sm text-fg-mist">No events are LIVE right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-fg-line hover:bg-transparent">
                  <TableHead className="text-fg-mist">Event</TableHead>
                  <TableHead className="text-fg-mist">Tenant</TableHead>
                  <TableHead className="text-fg-mist text-right">Devices (approx)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.liveEvents.map((e) => (
                  <TableRow key={e.id} className="border-fg-line">
                    <TableCell className="text-fg-ink">{e.name}</TableCell>
                    <TableCell className="text-fg-mist">{e.tenantName}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-fg-mist">
                      {e.activeDevicesApprox}
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

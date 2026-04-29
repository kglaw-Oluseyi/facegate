"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Users,
  ClipboardList,
  UserCircle,
  Menu,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const links = [
  { href: "/staff/guests", label: "Guests", icon: Users },
  { href: "/staff/check-in-log", label: "Check-In Log", icon: ClipboardList },
  { href: "/staff/profile", label: "My Profile", icon: UserCircle },
];

function roleLabel(role: StaffRole): string {
  return role.replaceAll("_", " ");
}

export function StaffShell({
  children,
  eventName,
}: {
  children: React.ReactNode;
  eventName: string | null;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;

  return (
    <div className="flex min-h-screen flex-col bg-fg-black text-fg-ink md:flex-row">
      <div className="w-full shrink-0 border-fg-line bg-fg-surface md:w-60 md:border-r">
        <div className="flex items-center justify-between border-b border-fg-line px-4 py-3 md:hidden">
          <div className="font-semibold text-fg-gold">FaceGate OS</div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="border-fg-line bg-fg-elevated">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="border-fg-line bg-fg-surface p-0">
              <StaffNav pathname={pathname} onNavigate={() => undefined} />
              <StaffFooter role={role} eventName={eventName} />
            </SheetContent>
          </Sheet>
        </div>

        <aside className="hidden min-h-screen w-60 flex-col md:flex">
          <div className="px-5 py-6">
            <div className="font-semibold tracking-tight text-fg-gold">FaceGate OS</div>
            <p className="mt-1 text-xs text-fg-mist">Staff workspace</p>
          </div>
          <StaffNav pathname={pathname} />
          <StaffFooter role={role} eventName={eventName} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-fg-line bg-fg-black/85 px-4 py-3 backdrop-blur md:px-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-mist">Active event</p>
            <p className="text-lg font-semibold text-fg-ink">{eventName ?? "—"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-fg-mist">{data?.user?.name}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-fg-line bg-fg-elevated"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function StaffNav({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-fg-elevated text-fg-gold"
                : "text-fg-mist hover:bg-fg-elevated hover:text-fg-ink"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function StaffFooter({
  role,
  eventName,
}: {
  role?: StaffRole;
  eventName: string | null;
}) {
  return (
    <div className="mt-auto px-5 py-6">
      <Separator className="mb-4 bg-fg-line" />
      <p className="text-xs uppercase tracking-wide text-fg-mist">Role</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-fg-line bg-fg-elevated text-fg-ink">
          {role ? roleLabel(role) : "—"}
        </Badge>
        {(role === "SUPERVISOR" || role === "ADMIN" || role === "PLATFORM_ADMIN") && (
          <span title="Elevated permissions" className="inline-flex items-center gap-1 text-xs text-amber-400/90">
            <Shield className="h-3.5 w-3.5" />
            Elevated
          </span>
        )}
      </div>
      {eventName ? (
        <p className="mt-3 truncate text-xs text-fg-mist" title={eventName}>
          {eventName}
        </p>
      ) : null}
    </div>
  );
}

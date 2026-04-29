"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  Menu,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/people", label: "People", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({
  onNavigate,
  showPlatform,
}: {
  onNavigate?: () => void;
  showPlatform?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
      {showPlatform ? (
        <Link
          href="/platform"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/platform")
              ? "bg-fg-elevated text-fg-gold"
              : "text-fg-mist hover:bg-fg-elevated hover:text-fg-ink"
          )}
        >
          <Shield className="h-4 w-4 shrink-0" />
          Platform
        </Link>
      ) : null}
    </nav>
  );
}

function SidebarFooter({ tenantName }: { tenantName: string }) {
  return (
    <div className="mt-auto px-5 py-6">
      <Separator className="mb-4 bg-fg-line" />
      <p className="text-xs uppercase tracking-wide text-fg-mist">Tenant</p>
      <p className="mt-1 text-sm font-medium text-fg-ink">{tenantName}</p>
    </div>
  );
}

export function AdminSidebar({
  tenantName,
  showPlatform,
}: {
  tenantName: string;
  showPlatform?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="w-full shrink-0 border-fg-line bg-fg-surface md:w-60 md:border-r">
      <div className="flex items-center justify-between border-b border-fg-line px-4 py-3 md:hidden">
        <div>
          <div className="font-semibold text-fg-gold">FaceGate OS</div>
          <p className="text-xs text-fg-mist">Facial re-entry control</p>
        </div>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="border-fg-line bg-fg-elevated">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="border-fg-line bg-fg-surface p-0 text-fg-ink">
            <div className="px-5 py-6">
              <div className="font-semibold text-fg-gold">FaceGate OS</div>
              <p className="mt-1 text-xs text-fg-mist">Navigation</p>
            </div>
            <NavLinks onNavigate={() => setMenuOpen(false)} showPlatform={showPlatform} />
            <SidebarFooter tenantName={tenantName} />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden min-h-[calc(100vh-0px)] w-60 flex-col md:flex">
        <div className="px-5 py-6">
          <div className="font-semibold tracking-tight text-fg-gold">FaceGate OS</div>
          <p className="mt-1 text-xs text-fg-mist">Facial re-entry control</p>
        </div>
        <NavLinks showPlatform={showPlatform} />
        <SidebarFooter tenantName={tenantName} />
      </aside>
    </div>
  );
}

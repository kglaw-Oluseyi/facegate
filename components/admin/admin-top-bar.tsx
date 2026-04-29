"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/admin/notification-bell";

function titleFromPath(pathname: string | null): string {
  if (!pathname) return "Console";
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/events") return "Events";
  if (pathname === "/events/new") return "Create Event";
  if (pathname.startsWith("/events/") && pathname.includes("/gates/new")) {
    return "Add Gate";
  }
  if (pathname.startsWith("/events/") && pathname.includes("/devices/new")) {
    return "Provision Device";
  }
  if (pathname.startsWith("/events/") && pathname.includes("/analytics")) return "Analytics";
  if (pathname.startsWith("/events/") && pathname.includes("/attempts")) return "Attempts";
  if (pathname.startsWith("/events/") && pathname.includes("/audit")) return "Audit log";
  if (pathname.startsWith("/events/") && pathname.includes("/deletion")) {
    return "Biometric deletion";
  }
  if (/^\/events\/[^/]+$/.test(pathname)) return "Command Centre";
  if (pathname === "/people") return "People";
  if (pathname === "/people/new") return "Create Staff User";
  if (pathname === "/settings") return "Settings";
  if (pathname.startsWith("/platform")) return "Platform";
  if (pathname.startsWith("/api-docs")) return "Integration API";
  return "Console";
}

export function AdminTopBar({
  userName,
  showPlatform,
}: {
  userName: string;
  showPlatform?: boolean;
}) {
  const pathname = usePathname();
  const params = useParams();
  const [eventName, setEventName] = useState<string | null>(null);

  const baseTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  useEffect(() => {
    const eventId = params?.eventId;
    if (typeof eventId !== "string" || !/^\/events\/[^/]+$/.test(pathname ?? "")) {
      setEventName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/events/${eventId}`);
      const json = await res.json();
      if (!cancelled && json?.data?.event?.name) {
        setEventName(json.data.event.name as string);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, pathname]);

  const displayTitle =
    baseTitle === "Command Centre" && eventName ? eventName : baseTitle;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-fg-line bg-fg-black/80 px-4 backdrop-blur md:px-8">
      <h1 className="truncate text-lg font-semibold tracking-tight text-fg-ink">{displayTitle}</h1>
      <div className="flex items-center gap-3">
        <NotificationBell />
        {showPlatform ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="hidden border-fg-line bg-fg-elevated sm:inline-flex"
          >
            <Link href="/platform">Platform</Link>
          </Button>
        ) : null}
        <span className="hidden text-sm text-fg-mist sm:inline">{userName}</span>
        <Separator orientation="vertical" className="hidden h-6 bg-fg-line sm:block" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-fg-line bg-fg-elevated text-fg-ink hover:bg-fg-surface"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}

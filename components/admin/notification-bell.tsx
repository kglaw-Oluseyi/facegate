"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  eventId: string | null;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json?.data) {
        setItems(json.data.notifications ?? []);
        setUnread(json.data.unreadCount ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    void load();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    void load();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative border-fg-line bg-fg-elevated text-fg-ink"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fg-gold px-1 text-[10px] font-semibold text-fg-black">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 border-fg-line bg-fg-surface text-fg-ink"
      >
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs font-normal text-fg-gold hover:underline"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-fg-line" />
        {loading && items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-fg-mist">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-fg-mist">
            No notifications yet.
          </div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex cursor-pointer flex-col items-start gap-1 py-3"
              onClick={() => {
                if (!n.read) void markRead(n.id);
              }}
            >
              <span className={`text-sm ${n.read ? "text-fg-mist" : "font-medium text-fg-ink"}`}>
                {n.title}
              </span>
              {n.body ? (
                <span className="text-xs text-fg-mist line-clamp-2">{n.body}</span>
              ) : null}
              {n.eventId ? (
                <Link
                  href={`/events/${n.eventId}`}
                  className="text-xs text-fg-gold hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open event
                </Link>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

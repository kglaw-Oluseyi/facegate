"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { EventMode } from "@prisma/client";
import { slugifyEventName } from "@/lib/slugify";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const schema = z
  .object({
    name: z.string().min(1, "Name is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
    venueName: z.string().min(1, "Venue name is required"),
    venueTimezone: z.string().min(1),
    startsAt: z.string().min(1, "Start is required"),
    endsAt: z.string().min(1, "End is required"),
    mode: z.nativeEnum(EventMode),
  })
  .refine(
    (v) => new Date(v.endsAt) > new Date(v.startsAt),
    { message: "End must be after start", path: ["endsAt"] }
  );

export default function NewEventPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueTimezone, setVenueTimezone] = useState("Europe/London");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [mode, setMode] = useState<EventMode>(EventMode.STANDALONE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyEventName(name));
    }
  }, [name, slugTouched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({
      name,
      slug,
      venueName,
      venueTimezone,
      startsAt,
      endsAt,
      mode,
    });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({
        name: f.name?.[0] ?? "",
        slug: f.slug?.[0] ?? "",
        venueName: f.venueName?.[0] ?? "",
        venueTimezone: f.venueTimezone?.[0] ?? "",
        startsAt: f.startsAt?.[0] ?? "",
        endsAt: f.endsAt?.[0] ?? "",
        mode: f.mode?.[0] ?? "",
      });
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt).toISOString(),
        endsAt: new Date(parsed.data.endsAt).toISOString(),
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      setErrors({ form: json.error ?? "Could not create event" });
      return;
    }
    router.push(`/events/${json.data.event.id}`);
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-2xl border-fg-line bg-fg-surface">
      <CardHeader>
        <CardTitle className="text-fg-ink">Create event</CardTitle>
        <CardDescription className="text-fg-mist">
          Configure venue, window, and operating mode. You can refine gates afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {errors.form ? <p className="text-sm text-fg-danger-text">{errors.form}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="border-fg-line bg-fg-elevated"
            />
            {errors.name ? <p className="text-sm text-fg-danger-text">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(ev) => {
                setSlugTouched(true);
                setSlug(ev.target.value);
              }}
              className="border-fg-line bg-fg-elevated font-mono text-sm"
            />
            {errors.slug ? <p className="text-sm text-fg-danger-text">{errors.slug}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue">Venue name</Label>
            <Input
              id="venue"
              value={venueName}
              onChange={(ev) => setVenueName(ev.target.value)}
              className="border-fg-line bg-fg-elevated"
            />
            {errors.venueName ? (
              <p className="text-sm text-fg-danger-text">{errors.venueName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={venueTimezone} onValueChange={setVenueTimezone}>
              <SelectTrigger className="border-fg-line bg-fg-elevated">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="border-fg-line bg-fg-elevated text-fg-ink">
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="starts">Starts at</Label>
              <Input
                id="starts"
                type="datetime-local"
                value={startsAt}
                onChange={(ev) => setStartsAt(ev.target.value)}
                className="border-fg-line bg-fg-elevated"
              />
              {errors.startsAt ? (
                <p className="text-sm text-fg-danger-text">{errors.startsAt}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends">Ends at</Label>
              <Input
                id="ends"
                type="datetime-local"
                value={endsAt}
                onChange={(ev) => setEndsAt(ev.target.value)}
                className="border-fg-line bg-fg-elevated"
              />
              {errors.endsAt ? (
                <p className="text-sm text-fg-danger-text">{errors.endsAt}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as EventMode)}>
              <SelectTrigger className="border-fg-line bg-fg-elevated">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-fg-line bg-fg-elevated text-fg-ink">
                <SelectItem value={EventMode.STANDALONE}>STANDALONE</SelectItem>
                <SelectItem value={EventMode.INTEGRATED}>INTEGRATED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="border-fg-line" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" className="bg-fg-gold text-fg-black hover:bg-fg-gold/90" disabled={loading}>
              {loading ? "Creating…" : "Create event"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

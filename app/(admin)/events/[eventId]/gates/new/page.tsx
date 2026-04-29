"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GateType } from "@prisma/client";
import { z } from "zod";
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

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(1, "Code is required")
    .regex(/^[A-Za-z0-9_-]+$/, "Alphanumeric characters only"),
  gateType: z.nativeEnum(GateType),
});

export default function NewGatePage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gateType, setGateType] = useState<GateType>(GateType.REENTRY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const parsed = schema.safeParse({ name, code, gateType });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setErrors({
        name: f.name?.[0] ?? "",
        code: f.code?.[0] ?? "",
        gateType: f.gateType?.[0] ?? "",
      });
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}/gates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      setErrors({ form: json.error ?? "Could not create gate" });
      return;
    }
    router.push(`/events/${eventId}`);
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-lg border-fg-line bg-fg-surface">
      <CardHeader>
        <CardTitle className="text-fg-ink">Add gate</CardTitle>
        <CardDescription className="text-fg-mist">Codes must be unique within this event.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {errors.form ? <p className="text-sm text-fg-danger-text">{errors.form}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="gname">Gate name</Label>
            <Input
              id="gname"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="border-fg-line bg-fg-elevated"
            />
            {errors.name ? <p className="text-sm text-fg-danger-text">{errors.name}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="gcode">Gate code</Label>
            <Input
              id="gcode"
              value={code}
              onChange={(ev) => setCode(ev.target.value.toUpperCase())}
              className="border-fg-line bg-fg-elevated font-mono"
            />
            {errors.code ? <p className="text-sm text-fg-danger-text">{errors.code}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Gate type</Label>
            <Select value={gateType} onValueChange={(v) => setGateType(v as GateType)}>
              <SelectTrigger className="border-fg-line bg-fg-elevated">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-fg-line bg-fg-elevated text-fg-ink">
                <SelectItem value={GateType.REENTRY}>REENTRY</SelectItem>
                <SelectItem value={GateType.CHECKIN}>CHECKIN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="border-fg-line" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" className="bg-fg-gold text-fg-black hover:bg-fg-gold/90" disabled={loading}>
              {loading ? "Saving…" : "Create gate"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

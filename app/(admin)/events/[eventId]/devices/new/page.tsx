"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy } from "lucide-react";

type GateOpt = { id: string; name: string; code: string };

export default function NewDevicePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.eventId as string;

  const [gates, setGates] = useState<GateOpt[]>([]);
  const [gateId, setGateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presetGate = searchParams.get("gateId");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/events/${eventId}/gate-health`);
      const json = await res.json();
      if (cancelled || !json?.data?.gates) return;
      const list: GateOpt[] = json.data.gates.map((g: { id: string; name: string; code: string }) => ({
        id: g.id,
        name: g.name,
        code: g.code,
      }));
      setGates(list);
      if (presetGate && list.some((g) => g.id === presetGate)) {
        setGateId(presetGate);
      } else if (list.length === 1) {
        setGateId(list[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, presetGate]);

  const gateLabel = useMemo(() => {
    const g = gates.find((x) => x.id === gateId);
    return g ? `${g.name} (${g.code})` : "";
  }, [gates, gateId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!gateId) {
      setError("Select a gate");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}/devices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gateId }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok || json.error) {
      setError(json.error ?? "Provisioning failed");
      return;
    }
    setPublicId(json.data.device.devicePublicId);
    setSecret(json.data.deviceSecret as string);
    setDone(true);
    toast.success("Device provisioned — copy credentials now");
  }

  async function copyVal(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy");
    }
  }

  if (done && publicId && secret) {
    return (
      <Card className="mx-auto max-w-xl border-fg-gold/30 bg-fg-surface">
        <CardHeader>
          <CardTitle className="text-fg-gold">Save these credentials</CardTitle>
          <CardDescription className="text-fg-mist">
            This secret is shown once. Store it in your vault before closing this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-fg-line bg-fg-elevated p-4">
            <p className="text-xs uppercase tracking-wide text-fg-mist">Device public ID</p>
            <p className="mt-1 break-all font-mono text-sm text-fg-ink">{publicId}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 border-fg-line"
              onClick={() => void copyVal("Public ID", publicId)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy public ID
            </Button>
          </div>
          <div className="rounded-md border border-fg-danger/40 bg-fg-black p-4">
            <p className="text-xs uppercase tracking-wide text-fg-danger-text">Device secret</p>
            <p className="mt-1 break-all font-mono text-sm text-fg-ink">{secret}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 border-fg-line"
              onClick={() => void copyVal("Secret", secret)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy secret
            </Button>
          </div>
          <p className="text-xs text-fg-mist">Gate: {gateLabel}</p>
          <Button
            type="button"
            className="w-full bg-fg-gold text-fg-black hover:bg-fg-gold/90"
            onClick={() => router.push(`/events/${eventId}`)}
          >
            Return to event
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg border-fg-line bg-fg-surface">
      <CardHeader>
        <CardTitle className="text-fg-ink">Provision device</CardTitle>
        <CardDescription className="text-fg-mist">
          Choose the gate this kiosk authenticates against. Heartbeats use Basic authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {gates.length === 0 ? (
            <p className="text-sm text-fg-mist">Create a gate before provisioning devices.</p>
          ) : (
            <div className="space-y-2">
              <Label>Gate</Label>
              <Select value={gateId} onValueChange={setGateId}>
                <SelectTrigger className="border-fg-line bg-fg-elevated">
                  <SelectValue placeholder="Select gate" />
                </SelectTrigger>
                <SelectContent className="border-fg-line bg-fg-elevated text-fg-ink">
                  {gates.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error ? <p className="text-sm text-fg-danger-text">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" className="border-fg-line" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
              disabled={loading || gates.length === 0}
            >
              {loading ? "Provisioning…" : "Generate credentials"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function KioskSetupScreen({
  devicePublicId,
  onActivated,
}: {
  devicePublicId: string;
  onActivated: (secret: string) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const auth =
        typeof window !== "undefined"
          ? `Basic ${btoa(`${devicePublicId}:${code}`)}`
          : "";
      const res = await fetch(`/api/kiosk/heartbeat?deviceToken=${encodeURIComponent(devicePublicId)}`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          camera_ok: true,
          provider_ok: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError("Incorrect access code. Please check with your event administrator.");
        return;
      }
      const storageKey = `fg-kiosk-secret:${devicePublicId}`;
      sessionStorage.setItem(storageKey, code);
      onActivated(code);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-sm tracking-wide text-fg-mist">Staff setup</p>
          <h1 className="text-xl font-medium text-fg-ink">Enter device access code</h1>
        </div>
        <Input
          type="password"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          className="h-14 border-fg-line bg-fg-elevated px-4 text-lg text-fg-ink placeholder:text-fg-mist focus-visible:border-fg-gold focus-visible:ring-fg-gold/40"
          placeholder="Access code"
        />
        {error ? <p className="text-center text-sm text-fg-danger-text">{error}</p> : null}
        <Button
          type="button"
          disabled={loading || !code.trim()}
          className="h-12 w-full bg-fg-gold text-fg-black hover:bg-fg-gold/90"
          onClick={() => void submit()}
        >
          {loading ? "Checking…" : "Activate Gate"}
        </Button>
      </div>
    </div>
  );
}

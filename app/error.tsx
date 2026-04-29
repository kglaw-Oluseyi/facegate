"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-fg-ink">Something went wrong</h1>
      <p className="max-w-md text-sm text-fg-mist">
        {error.message || "An unexpected error occurred. You can retry or return home."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          className="bg-fg-gold text-fg-black hover:bg-fg-gold/90"
          onClick={() => reset()}
        >
          Try again
        </Button>
        <Button asChild variant="outline" className="border-fg-line">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

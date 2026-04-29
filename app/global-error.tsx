"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-neutral-100 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">FaceGate OS hit a fatal error</h1>
          <p className="max-w-md text-sm text-neutral-400">{error.message}</p>
          <button
            type="button"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black"
            onClick={() => reset()}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

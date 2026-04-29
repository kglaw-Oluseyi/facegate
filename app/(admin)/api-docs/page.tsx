import Link from "next/link";

export default function IntegrationApiDocsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-fg-mist">
        <Link href="/dashboard" className="text-fg-gold no-underline hover:underline">
          ← Dashboard
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-fg-ink">Integration API</h1>
      <p>
        Authenticate with{" "}
        <code className="rounded bg-fg-elevated px-1 text-fg-gold">
          Authorization: Bearer INTEGRATION_API_KEY
        </code>
      </p>
      <h2 className="text-lg font-medium text-fg-ink">Endpoints</h2>
      <ul className="list-disc space-y-2">
        <li>
          <code>GET /api/v1/events/[slug]/status</code> — event + admission snapshot.
        </li>
        <li>
          <code>POST /api/v1/events/[slug]/guests/sync</code> — upsert guests from integration
          manifests.
        </li>
      </ul>
      <p className="text-sm">
        Default tenant resolution uses{" "}
        <code className="rounded bg-fg-elevated px-1">INTEGRATION_DEFAULT_TENANT_SLUG</code>{" "}
        when the slug does not include an explicit tenant prefix.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MANUAL_SECTIONS, type ManualSection } from "@/lib/manual/content";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type ManualCategory = ManualSection["category"] | "all";

const CATEGORY_LABEL: Record<ManualCategory, string> = {
  all: "All",
  setup: "Setup",
  operations: "Operations",
  exceptions: "Exceptions",
  privacy: "Privacy",
  technical: "Technical",
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-fg-gold/20 px-0.5 text-fg-ink">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

function plainSnippet(md: string, max = 180): string {
  const stripped = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > max ? `${stripped.slice(0, max)}…` : stripped;
}

export function OperationsManual() {
  const [category, setCategory] = useState<ManualCategory>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MANUAL_SECTIONS.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [category, query]);

  useEffect(() => {
    if (filtered.length === 0) return;
    const id = filtered[0].id;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [category]); // smooth scroll on category click

  return (
    <div className="flex min-h-[70vh] flex-col gap-6 md:flex-row">
      <aside className="w-full shrink-0 md:w-60">
        <div className="space-y-2 rounded-md border border-fg-line bg-fg-surface p-3">
          {(Object.keys(CATEGORY_LABEL) as ManualCategory[]).map((id) => {
            const active = id === category;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={[
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "border-l-2 border-fg-gold bg-fg-elevated text-fg-ink"
                    : "text-fg-mist hover:bg-fg-elevated hover:text-fg-ink",
                ].join(" ")}
              >
                {CATEGORY_LABEL[id]}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Search the manual…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 border-fg-line bg-fg-elevated text-fg-ink"
          />
          <p className="text-xs text-fg-mist">
            Searches title, content, and tags. {filtered.length} result(s).
          </p>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-fg-line border-dashed bg-fg-surface">
            <CardContent className="py-12 text-center text-fg-mist">
              No results for{" "}
              <span className="font-mono text-fg-ink">{query.trim() || "—"}</span>. Try
              different keywords.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {filtered.map((s, idx) => (
              <div key={s.id} id={s.id} className="scroll-mt-24">
                <div className="mb-3">
                  <h2 className="text-xl font-semibold tracking-tight text-fg-ink">
                    {highlightText(s.title, query)}
                  </h2>
                  <p className="mt-1 text-xs text-fg-mist">
                    {CATEGORY_LABEL[s.category]} ·{" "}
                    {highlightText(plainSnippet(s.content), query)}
                  </p>
                </div>
                <div className="prose prose-invert max-w-none prose-headings:text-fg-ink prose-p:text-fg-mist prose-li:text-fg-mist prose-strong:text-fg-ink">
                  <ReactMarkdown>{s.content}</ReactMarkdown>
                </div>
                {idx < filtered.length - 1 ? (
                  <div className="mt-8 h-px w-full bg-fg-line/80" />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


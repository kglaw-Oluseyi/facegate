"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HelpButton() {
  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className="border-fg-line bg-fg-elevated text-fg-mist transition-colors duration-150 hover:text-fg-gold"
      aria-label="Operations Manual"
      title="Operations Manual"
    >
      <Link href="/admin/help">
        <HelpCircle className="h-4 w-4" />
      </Link>
    </Button>
  );
}


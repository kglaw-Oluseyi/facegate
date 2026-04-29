import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { isPlatformAdmin } from "@/lib/roles";
import { ThemeProvider } from "@/lib/theme-context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { name: true },
  });

  const platform = isPlatformAdmin(session);

  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col bg-fg-black text-fg-ink md:flex-row">
        <AdminSidebar
          tenantName={tenant?.name ?? "Organisation"}
          showPlatform={platform}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar
            userName={session.user.name ?? session.user.email ?? "User"}
            showPlatform={platform}
          />
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}

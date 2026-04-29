import { prisma } from "@/lib/prisma";

export async function resolveIntegrationEventBySlug(slug: string) {
  const tenantSlug =
    process.env.INTEGRATION_DEFAULT_TENANT_SLUG?.trim() || "maison-doclar";
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return null;

  return prisma.event.findFirst({
    where: { tenantId: tenant.id, slug },
    select: {
      id: true,
      tenantId: true,
      name: true,
      slug: true,
      status: true,
      mode: true,
    },
  });
}

export function verifyIntegrationApiKey(req: Request): boolean {
  const expected = process.env.INTEGRATION_API_KEY?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  return bearer === expected;
}

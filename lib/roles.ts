import type { Session } from "next-auth";
import type { StaffRole } from "@prisma/client";

export function canAdminWrite(session: Session | null): boolean {
  const role = session?.user?.role;
  return role === "ADMIN" || role === "PLATFORM_ADMIN";
}

export function canManageStaff(session: Session | null): boolean {
  return canAdminWrite(session);
}

export function isPlatformAdmin(session: Session | null): boolean {
  return session?.user?.role === "PLATFORM_ADMIN";
}

/** Supervisor and above — analytics, attempt logs, stream */
export function canViewOperationalInsights(session: Session | null): boolean {
  const role = session?.user?.role;
  return (
    role === "SUPERVISOR" ||
    role === "ADMIN" ||
    role === "PLATFORM_ADMIN"
  );
}

/** CSV exports and audit exports */
export function canExportSensitiveReports(session: Session | null): boolean {
  return canAdminWrite(session);
}

export function parseStaffRole(value: string): StaffRole | null {
  if (
    value === "PLATFORM_ADMIN" ||
    value === "ADMIN" ||
    value === "SUPERVISOR" ||
    value === "STAFF"
  ) {
    return value;
  }
  return null;
}

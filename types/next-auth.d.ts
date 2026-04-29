import type { DefaultSession } from "next-auth";
import type { StaffRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: StaffRole;
      tenantId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: StaffRole;
    tenantId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: StaffRole;
    tenantId: string;
  }
}

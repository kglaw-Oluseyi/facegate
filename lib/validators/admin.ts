import { z } from "zod";
import { EventMode, EventStatus, GateType, StaffRole } from "@prisma/client";

export const createEventBody = z
  .object({
    name: z.string().min(1, "Name is required"),
    slug: z
      .string()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only"),
    venueName: z.string().min(1, "Venue is required"),
    venueTimezone: z.string().min(1, "Timezone is required"),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    mode: z.nativeEnum(EventMode),
  })
  .refine(
    (v) => {
      const a = new Date(v.startsAt);
      const b = new Date(v.endsAt);
      return b > a;
    },
    { message: "End must be after start", path: ["endsAt"] }
  );

export const patchEventStatusBody = z.object({
  status: z.nativeEnum(EventStatus),
});

export const createGateBody = z.object({
  name: z.string().min(1),
  code: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_-]+$/i, "Alphanumeric code only"),
  gateType: z.nativeEnum(GateType),
});

export const createDeviceBody = z.object({
  gateId: z.string().min(1),
});

export const createStaffBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(StaffRole),
});

export const patchStaffStatusBody = z.object({
  isActive: z.boolean(),
});

export const patchEventKioskConfigBody = z.object({
  consentMode: z.enum(["per-guest", "per-event"]),
  allowNameDisplay: z.boolean(),
  allowCopy: z.string().min(1),
  denyCopy: z.string().min(1),
  errorCopy: z.string().min(1),
  unavailableCopy: z.string().min(1),
  resetAfterMs: z.number().int().min(1000).max(120_000),
  consentPerEventConfirmed: z.boolean().optional(),
});

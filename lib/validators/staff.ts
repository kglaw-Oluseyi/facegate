import { z } from "zod";

export const createGuestBody = z.object({
  eventId: z.string().min(1),
  name: z.string().optional(),
  externalId: z.string().optional(),
});

export const guestSearchQuery = z.object({
  eventId: z.string().min(1),
  search: z.string().optional(),
  cursor: z.string().optional(),
});

export const patchAdmissionBody = z.object({
  action: z.enum(["CHECKIN", "REVOKE", "RESTORE"]),
  reason: z.string().optional(),
});

export const enrollBody = z.object({
  guestId: z.string().min(1),
  eventId: z.string().min(1),
  imageBase64: z.string().min(1),
});

export const enrollTransferBody = z.object({
  guestId: z.string().min(1),
  eventId: z.string().min(1),
  conflictingEnrollmentId: z.string().min(1),
  imageBase64: z.string().min(1),
});

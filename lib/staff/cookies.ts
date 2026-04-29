export const STAFF_EVENT_COOKIE = "fg-staff-event-id";

export const staffEventCookieOptions = {
  httpOnly: true as const,
  path: "/",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 12,
  secure: process.env.NODE_ENV === "production",
};

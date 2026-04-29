import { randomUUID } from "crypto";
import type { BiometricProvider } from "@/lib/biometric/types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockProvider implements BiometricProvider {
  async enroll(options: {
    eventId: string;
    guestId: string;
    imageBase64: string;
  }): Promise<{ ref: string; provider: string }> {
    const ref = randomUUID();
    console.info("[FaceGate mock biometric] enroll", {
      eventId: options.eventId,
      guestId: options.guestId,
      ref,
      imageBytes: options.imageBase64?.length ?? 0,
    });
    return { ref, provider: "mock" };
  }

  async match(options: {
    eventId: string;
    imageBase64: string;
    enrolledRefs: string[];
  }): Promise<{
    matched: boolean;
    matchedRef?: string;
    confidence?: number;
  }> {
    const ms = 200 + Math.floor(Math.random() * 200);
    await delay(ms);
    if (options.enrolledRefs.length === 0) {
      return { matched: false };
    }
    return {
      matched: true,
      matchedRef: options.enrolledRefs[0],
      confidence: 0.97,
    };
  }

  async deleteRefs(options: {
    eventId: string;
    refs: string[];
  }): Promise<{ deleted: string[]; failed: string[] }> {
    console.info("[FaceGate mock biometric] deleteRefs", {
      eventId: options.eventId,
      count: options.refs.length,
    });
    return { deleted: [...options.refs], failed: [] };
  }

  async deleteCollection(eventId: string): Promise<{ success: boolean }> {
    console.info("[FaceGate mock biometric] deleteCollection", { eventId });
    return { success: true };
  }

  async status(): Promise<{ ready: boolean; provider: string }> {
    return { ready: true, provider: "mock" };
  }
}

export interface BiometricProvider {
  enroll(options: {
    eventId: string;
    guestId: string;
    imageBase64: string;
  }): Promise<{ ref: string; provider: string }>;

  match(options: {
    eventId: string;
    imageBase64: string;
    enrolledRefs: string[];
  }): Promise<{
    matched: boolean;
    matchedRef?: string;
    confidence?: number;
  }>;

  deleteRefs(options: {
    eventId: string;
    refs: string[];
  }): Promise<{
    deleted: string[];
    failed: string[];
  }>;

  deleteCollection(eventId: string): Promise<{ success: boolean }>;

  status(): Promise<{ ready: boolean; provider: string }>;
}

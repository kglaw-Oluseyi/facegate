import type { BiometricProvider } from "@/lib/biometric/types";
import { MockProvider } from "@/lib/biometric/mock-provider";
import { AWSProvider } from "@/lib/biometric/aws-provider";

export type { BiometricProvider } from "@/lib/biometric/types";

export function getBiometricProvider(): BiometricProvider {
  const provider = process.env.BIOMETRIC_PROVIDER ?? "mock";
  if (provider === "aws") return new AWSProvider();
  return new MockProvider();
}

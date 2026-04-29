import { getBiometricProvider } from "@/lib/biometric";
import { BiometricProviderError } from "@/lib/biometric/errors";
import { jsonOk } from "@/lib/api-response";

export async function GET() {
  try {
    const status = await getBiometricProvider().status();
    return jsonOk({ ready: status.ready, provider: status.provider });
  } catch (e) {
    if (e instanceof BiometricProviderError) {
      return jsonOk({ ready: false, provider: process.env.BIOMETRIC_PROVIDER ?? "mock" });
    }
    throw e;
  }
}

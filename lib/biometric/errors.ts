export class BiometricProviderError extends Error {
  readonly provider: string;
  readonly causeDetail?: unknown;

  constructor(message: string, provider: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "BiometricProviderError";
    this.provider = provider;
    this.causeDetail = options?.cause;
  }
}

import { KioskScanEngine } from "@/components/kiosk/scan-engine";

export default async function KioskDevicePage({
  params,
}: {
  params: Promise<{ deviceToken: string }>;
}) {
  const { deviceToken } = await params;

  if (!deviceToken) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#0A0A0A] px-8 text-center">
        <p className="max-w-md text-lg text-[#F5F5F0]">
          This kiosk link is invalid (missing device). Use the URL provided by your event
          administrator, including the device segment after{" "}
          <span className="font-mono text-fg-gold">/kiosk/</span>.
        </p>
      </div>
    );
  }

  return <KioskScanEngine devicePublicId={deviceToken} />;
}

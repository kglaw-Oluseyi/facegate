import { KioskScanEngine } from "@/components/kiosk/scan-engine";

export default function KioskDevicePage({
  params,
}: {
  params: { deviceToken: string };
}) {
  return <KioskScanEngine devicePublicId={params.deviceToken} />;
}

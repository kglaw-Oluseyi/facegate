import { jsPDF } from "jspdf";

export type DeletionCertificateInput = {
  eventName: string;
  enrollmentCount: number;
  completedAtIso: string;
  deletionRunId: string;
  confirmedByName: string;
  providerConfirmed: boolean;
};

export function buildDeletionCertificatePdf(
  input: DeletionCertificateInput
): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(17, 17, 17);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  doc.setTextColor(201, 168, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("FaceGate OS", pageW / 2, 80, { align: "center" });

  doc.setFontSize(16);
  doc.text("Biometric Data Deletion Certificate", pageW / 2, 115, {
    align: "center",
  });

  doc.setTextColor(240, 240, 240);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  let y = 160;
  const line = (label: string, value: string) => {
    doc.setTextColor(180, 180, 180);
    doc.text(label, 60, y);
    doc.setTextColor(245, 245, 240);
    doc.text(value, pageW - 60, y, { align: "right" });
    y += 26;
  };

  line("Event", input.eventName);
  line("Enrollments deleted", String(input.enrollmentCount));
  line("Deletion completed", new Date(input.completedAtIso).toUTCString());
  line("Audit reference", input.deletionRunId);
  line("Confirmed by", input.confirmedByName);
  line(
    "Provider confirmed",
    input.providerConfirmed ? "Yes" : "No"
  );

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.text(
    "This certificate confirms FaceGate OS biometric reference deletion workflow.",
    pageW / 2,
    doc.internal.pageSize.getHeight() - 48,
    { align: "center" }
  );

  return doc.output("arraybuffer") as ArrayBuffer;
}

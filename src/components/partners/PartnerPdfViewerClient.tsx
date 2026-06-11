"use client";

import dynamic from "next/dynamic";

const PartnerPdfViewer = dynamic(
  () =>
    import("@/components/partners/PartnerPdfViewer").then(
      (m) => m.PartnerPdfViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="border border-border rounded-xl flex items-center justify-center h-80 text-sm text-muted-foreground">
        Loading proposal…
      </div>
    ),
  }
);

export function PartnerPdfViewerClient({ pdfUrl }: { pdfUrl: string }) {
  return <PartnerPdfViewer pdfUrl={pdfUrl} />;
}

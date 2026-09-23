"use client";

import { Component, type ReactNode } from "react";
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
        Loading PDF…
      </div>
    ),
  }
);

// A viewer failure (pdf.js worker, a bad file) should degrade to a link, not
// take the whole page down to the app-level error screen.
class PdfBoundary extends Component<{ pdfUrl: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="border border-border rounded-xl flex flex-col items-center justify-center gap-2 h-56 px-4 text-center text-sm text-muted-foreground">
        <p>Couldn&rsquo;t display this document here.</p>
        <a href={this.props.pdfUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-foreground">
          Open the PDF in a new tab
        </a>
      </div>
    );
  }
}

export function PartnerPdfViewerClient({ pdfUrl, fixedA4Portrait }: { pdfUrl: string; fixedA4Portrait?: boolean }) {
  return (
    <PdfBoundary pdfUrl={pdfUrl}>
      <PartnerPdfViewer pdfUrl={pdfUrl} fixedA4Portrait={fixedA4Portrait} />
    </PdfBoundary>
  );
}

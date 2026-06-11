"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Download,
} from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  pdfUrl: string;
}

export function PartnerPdfViewer({ pdfUrl }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      fullscreenRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Pages to keep mounted: current ± 1. Keyed by page number so React
  // preserves the already-rendered canvas when the current page changes.
  const pagesToMount = [pageNumber - 1, pageNumber, pageNumber + 1].filter(
    (p) => p >= 1 && p <= numPages
  );

  if (!pdfUrl) {
    return (
      <div className="border border-border rounded-xl overflow-hidden bg-stone-50">
        <div className="flex flex-col items-center justify-center h-72 gap-2">
          <p className="text-sm text-muted-foreground">Proposal PDF not yet uploaded.</p>
          <p className="font-mono text-xs text-stone-400">
            Set pdfUrl in PARTNER_CONFIGS to display here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={fullscreenRef} className="border border-border rounded-xl overflow-hidden bg-stone-100">
      {/* Page area */}
      <div ref={containerRef} className="relative">
        {/* Left arrow */}
        <button
          onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
          aria-label="Previous page"
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/85 border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
          disabled={pageNumber >= numPages}
          aria-label="Next page"
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/85 border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>

        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={
            <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
              Loading proposal…
            </div>
          }
          error={
            <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
              Could not load PDF. Check the URL in partner config.
            </div>
          }
        >
          {containerWidth > 0 &&
            pagesToMount.map((p) => {
              const isCurrent = p === pageNumber;
              return (
                <div
                  key={p}
                  style={
                    isCurrent
                      ? { position: "relative" }
                      : {
                          position: "absolute",
                          top: 0,
                          left: 0,
                          opacity: 0,
                          pointerEvents: "none",
                          userSelect: "none",
                        }
                  }
                  aria-hidden={!isCurrent}
                >
                  <Page
                    pageNumber={p}
                    width={containerWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              );
            })}
        </Document>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-white">
        <span className="font-mono text-xs text-muted-foreground">
          {pageNumber} / {numPages || "—"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 border border-border rounded-md hover:bg-stone-50 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
          <a
            href={pdfUrl}
            download
            className="flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 border border-border rounded-md hover:bg-stone-50 transition-colors"
          >
            <Download size={12} />
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}

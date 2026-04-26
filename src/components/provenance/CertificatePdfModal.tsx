"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Workers must run from a same-origin script in production. Bundlers resolve this
// to a hashed asset URL; in dev it's served from the package directly.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface Props {
  pdfUrl: string;
  filename?: string;
  onClose: () => void;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function CertificatePdfModal({ pdfUrl, filename = "provenance-certificate.pdf", onClose }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [zoomIdx, setZoomIdx] = useState<number>(2); // start at 1.0
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  // Stabilise the file source so react-pdf doesn't re-fetch on every render.
  const file = useMemo(() => ({ url: pdfUrl, withCredentials: true }), [pdfUrl]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const zoom = ZOOM_STEPS[zoomIdx];

  function handleDownload() {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handlePrint() {
    try {
      const res = await fetch(pdfUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load PDF for printing");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Reuse the iframe so back-to-back prints don't pile up
      const existing = printFrameRef.current;
      const iframe = existing ?? document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      if (!existing) {
        document.body.appendChild(iframe);
        printFrameRef.current = iframe;
      }
      iframe.src = blobUrl;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // Some browsers block cross-origin print — fall back to opening in a tab
          window.open(blobUrl, "_blank", "noopener");
        }
      };
    } catch (err) {
      console.error(err);
      window.open(pdfUrl, "_blank", "noopener");
    }
  }

  // Width-based scale: the page renders at the container width × zoom.
  // Cap at a sensible maximum so 200% zoom doesn't render at 4000px on a 4K screen.
  const renderWidth = containerWidth
    ? Math.min(containerWidth - 32, 900) * zoom
    : 600 * zoom;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Provenance certificate"
    >
      <div
        className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 h-12 border-b border-stone-200 bg-stone-50">
          <span className="text-xs text-stone-500 font-mono tabular-nums whitespace-nowrap">
            {numPages > 0 ? `${numPages} ${numPages === 1 ? "page" : "pages"}` : "—"}
          </span>

          <div className="flex items-center gap-1.5 text-xs text-stone-600">
            <button
              type="button"
              onClick={() => setZoomIdx(i => Math.max(0, i - 1))}
              disabled={zoomIdx === 0}
              aria-label="Zoom out"
              className="p-1.5 rounded hover:bg-stone-200 transition-colors disabled:opacity-30"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="font-mono tabular-nums whitespace-nowrap min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomIdx(i => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              disabled={zoomIdx === ZOOM_STEPS.length - 1}
              aria-label="Zoom in"
              className="p-1.5 rounded hover:bg-stone-200 transition-colors disabled:opacity-30"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-stone-700 rounded hover:bg-stone-200 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
              </svg>
              Print
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white bg-stone-900 rounded hover:bg-stone-700 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-1 p-1.5 rounded hover:bg-stone-200 transition-colors text-stone-500"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Document area — continuous vertical scroll, all pages stacked */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-stone-200 px-4 py-6"
        >
          {loadError ? (
            <div className="h-full flex items-center justify-center text-sm text-stone-600 max-w-sm mx-auto text-center">
              <div>
                <p className="font-medium text-stone-900 mb-1">Couldn’t load certificate</p>
                <p className="text-xs">{loadError}</p>
              </div>
            </div>
          ) : (
            <Document
              file={file}
              onLoadSuccess={({ numPages: n }) => { setNumPages(n); setLoadError(null); }}
              onLoadError={(err) => setLoadError(err?.message ?? "Failed to load PDF")}
              loading={
                <div className="h-full flex items-center justify-center text-sm text-stone-500">
                  Loading certificate…
                </div>
              }
              className="flex flex-col items-center gap-4"
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  width={renderWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-lg bg-white"
                />
              ))}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}

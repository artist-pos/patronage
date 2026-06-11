"use client";

import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Download,
  X,
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
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);

  // Measure normal container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setContainerWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure overlay container width when open
  useEffect(() => {
    const el = overlayInnerRef.current;
    if (!el || !isMobileFullscreen) return;
    const ro = new ResizeObserver((e) => setOverlayWidth(e[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobileFullscreen]);

  // Track native fullscreen changes
  useEffect(() => {
    const handler = () => setIsNativeFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Lock body scroll when mobile overlay is open
  useEffect(() => {
    if (isMobileFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobileFullscreen]);

  async function toggleFullscreen() {
    // Close mobile overlay
    if (isMobileFullscreen) {
      setIsMobileFullscreen(false);
      try { await (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.(); } catch {}
      return;
    }

    // Exit native fullscreen
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    // Try native fullscreen (works on desktop + Android Chrome)
    if (fullscreenRef.current && document.fullscreenEnabled) {
      try {
        await fullscreenRef.current.requestFullscreen();
        return;
      } catch {
        // Falls through to mobile overlay below
      }
    }

    // Mobile fallback: custom overlay + orientation lock
    setIsMobileFullscreen(true);
    try {
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch {
      // iOS doesn't support orientation lock — user can rotate manually
    }
  }

  const isFullscreen = isNativeFullscreen || isMobileFullscreen;

  // Pages to keep mounted: current ± 1
  function pageSet(width: number) {
    if (width === 0 || numPages === 0) return null;
    const pages = [pageNumber - 1, pageNumber, pageNumber + 1].filter(
      (p) => p >= 1 && p <= numPages
    );
    return pages.map((p) => {
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
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </div>
      );
    });
  }

  const navButtons = (onPrev: () => void, onNext: () => void) => (
    <>
      <button
        onClick={onPrev}
        disabled={pageNumber <= 1}
        aria-label="Previous page"
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/85 border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={onNext}
        disabled={pageNumber >= numPages}
        aria-label="Next page"
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/85 border border-border shadow-sm hover:bg-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <ChevronRight size={18} />
      </button>
    </>
  );

  const footerBar = (
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
    <>
      {/* ── Normal viewer ──────────────────────────────────────────────── */}
      <div
        ref={fullscreenRef}
        className="border border-border rounded-xl overflow-hidden bg-stone-100"
      >
        <div ref={containerRef} className="relative">
          {navButtons(
            () => setPageNumber((p) => Math.max(1, p - 1)),
            () => setPageNumber((p) => Math.min(numPages, p + 1))
          )}
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
                Could not load PDF.
              </div>
            }
          >
            {pageSet(containerWidth)}
          </Document>
        </div>
        {footerBar}
      </div>

      {/* ── Mobile fullscreen overlay ───────────────────────────────────── */}
      {isMobileFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          {/* Close button */}
          <button
            onClick={toggleFullscreen}
            aria-label="Exit fullscreen"
            className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
          >
            <X size={18} />
          </button>

          {/* Page area */}
          <div ref={overlayInnerRef} className="relative flex-1 overflow-hidden">
            {navButtons(
              () => setPageNumber((p) => Math.max(1, p - 1)),
              () => setPageNumber((p) => Math.min(numPages, p + 1))
            )}
            <Document file={pdfUrl}>
              <div className="flex items-center justify-center h-full">
                {pageSet(overlayWidth)}
              </div>
            </Document>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10">
            <span className="font-mono text-xs text-white/60">
              {pageNumber} / {numPages || "—"}
            </span>
            <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
              Rotate device for landscape
            </span>
          </div>
        </div>
      )}
    </>
  );
}

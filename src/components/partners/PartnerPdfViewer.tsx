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
  /** Locks the page area to A4-portrait proportions regardless of each
   *  page's own orientation, so paging through a mixed-orientation document
   *  doesn't resize the viewer under the reader. A landscape page just
   *  renders smaller, centred in the same fixed frame, instead of the
   *  whole viewer growing wider/shorter per page. */
  fixedA4Portrait?: boolean;
}

const A4_RATIO = 297 / 210; // height / width

export function PartnerPdfViewer({ pdfUrl, fixedA4Portrait = false }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isMobileFullscreen, setIsMobileFullscreen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [overlayWidth, setOverlayWidth] = useState(0);
  const [overlayHeight, setOverlayHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);

  // Measure normal container size. Height is only consumed in fullscreen,
  // where the container is a fixed flex-1 area — outside fullscreen it's sized
  // by the page itself, so it must never drive the page size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      setContainerWidth(e[0].contentRect.width);
      // Height only matters in native fullscreen — tracking it otherwise just
      // feeds the page's own height back into re-renders.
      if (document.fullscreenElement) setContainerHeight(e[0].contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Measure overlay container when open
  useEffect(() => {
    const el = overlayInnerRef.current;
    if (!el || !isMobileFullscreen) return;
    const ro = new ResizeObserver((e) => {
      setOverlayWidth(e[0].contentRect.width);
      setOverlayHeight(e[0].contentRect.height);
    });
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

  // Pages to keep mounted: current ± 1. In fullscreen the page is sized by
  // the available HEIGHT so a whole page always fits the screen (sizing by
  // width made portrait pages many screens tall); react-pdf ignores height
  // when width is also given, so only one is passed.
  function pageSet(width: number, fitHeight = 0) {
    if ((fitHeight === 0 && width === 0) || numPages === 0) return null;
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
            {...(fitHeight > 0 ? { height: fitHeight } : { width })}
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
        {pageNumber} / {numPages || "–"}
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
        className={
          isNativeFullscreen
            ? "flex flex-col h-screen bg-stone-100"
            : "border border-border rounded-xl overflow-hidden bg-stone-100"
        }
      >
        <div
          ref={containerRef}
          className={isNativeFullscreen ? "relative flex-1 min-h-0 overflow-hidden" : "relative"}
        >
          {navButtons(
            () => setPageNumber((p) => Math.max(1, p - 1)),
            () => setPageNumber((p) => Math.min(numPages, p + 1))
          )}
          <div
            style={
              isNativeFullscreen
                ? { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }
                : fixedA4Portrait && containerWidth > 0
                  ? { height: containerWidth * A4_RATIO, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }
                  : undefined
            }
          >
            <Document
              file={pdfUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={
                <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
                  Loading PDF…
                </div>
              }
              error={
                <div className="flex items-center justify-center h-80 text-sm text-muted-foreground">
                  Could not load PDF.
                </div>
              }
            >
              {isNativeFullscreen ? pageSet(containerWidth, containerHeight) : pageSet(containerWidth)}
            </Document>
          </div>
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
                {pageSet(overlayWidth, overlayHeight)}
              </div>
            </Document>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/60 border-t border-white/10">
            <span className="font-mono text-xs text-white/60">
              {pageNumber} / {numPages || "–"}
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

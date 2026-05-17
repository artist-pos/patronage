"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Download, Link, Check } from "lucide-react";
import type { SharePayload, ShareTemplate, ShareFormat } from "@/types/share";
import { drawShareCanvas } from "@/lib/share-canvas";

interface Props {
  payload: SharePayload;
  onClose: () => void;
}

const TEMPLATES: { id: ShareTemplate; label: string; bg: string; text: string }[] = [
  { id: "dark",  label: "Dark",  bg: "#0f0f0f", text: "#ffffff" },
  { id: "light", label: "Light", bg: "#fafaf9", text: "#1a1a1a" },
  { id: "warm",  label: "Warm",  bg: "#1a1208", text: "#f5e6c8" },
  { id: "slate", label: "Slate", bg: "#1c2333", text: "#e8edf5" },
];

export function ShareSheet({ payload, onClose }: Props) {
  const [template, setTemplate] = useState<ShareTemplate>("light");
  const [format, setFormat] = useState<ShareFormat>("story");
  const [showPrice, setShowPrice] = useState(true);
  const [caption, setCaption] = useState("");
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(
    payload.imageOptions?.[0]?.url ?? payload.imageUrl
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load selected image when it changes
  useEffect(() => {
    const url = selectedImageUrl;
    if (!url) { setImgEl(null); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImgEl(img);
    img.onerror = () => setImgEl(null);
    img.src = url;
  }, [selectedImageUrl]);

  const redraw = useCallback(async () => {
    if (!canvasRef.current) return;
    const effectivePayload = selectedImageUrl !== payload.imageUrl
      ? { ...payload, imageUrl: selectedImageUrl }
      : payload;
    await drawShareCanvas(canvasRef.current, effectivePayload, template, format, imgEl, showPrice, caption);
  }, [payload, template, format, imgEl, showPrice, caption, selectedImageUrl]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleDownload() {
    if (!canvasRef.current) return;
    let dataUrl: string;
    try {
      dataUrl = canvasRef.current.toDataURL("image/png");
    } catch {
      // CORS taint — redraw without image and try again
      await drawShareCanvas(canvasRef.current, payload, template, format, null, showPrice, caption);
      try { dataUrl = canvasRef.current.toDataURL("image/png"); } catch { return; }
      // Restore
      redraw();
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `patronage-share-${payload.type}.png`;
    a.click();
    // Also copy link
    copyLink();
  }

  function copyLink() {
    navigator.clipboard.writeText(payload.shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const scale = format === "story" ? 0.21 : 0.31;
  const previewW = Math.round((format === "story" ? 1080 : 1080) * scale);
  const previewH = Math.round((format === "story" ? 1920 : 1080) * scale);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="
          w-full bg-background border-t border-black
          sm:w-auto sm:max-w-2xl sm:border sm:rounded-none
          flex flex-col sm:flex-row gap-0
          max-h-[92vh] overflow-y-auto sm:overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Preview panel ── */}
        <div className="flex items-center justify-center bg-stone-100 p-5 sm:p-8 shrink-0">
          <canvas
            ref={canvasRef}
            style={{
              width: previewW,
              height: previewH,
              display: "block",
              boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            }}
          />
        </div>

        {/* ── Controls panel ── */}
        <div className="flex-none sm:flex sm:flex-col sm:min-h-0 w-full sm:w-[260px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <p className="text-xs font-semibold uppercase tracking-widest">Share</p>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="sm:flex-1 sm:overflow-y-auto px-4 py-4 space-y-5 sm:min-h-0">

            {/* Image picker — profile share with multiple options */}
            {payload.imageOptions && payload.imageOptions.length > 1 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Image</p>
                <div className="flex gap-1.5 flex-wrap">
                  {payload.imageOptions.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImageUrl(opt.url)}
                      title={opt.label}
                      className={`w-12 h-12 border overflow-hidden shrink-0 transition-all ${
                        selectedImageUrl === opt.url ? "border-black ring-1 ring-black ring-offset-1" : "border-border"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={opt.url} alt={opt.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Format */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Format</p>
              <div className="flex gap-2">
                {(["story", "post"] as ShareFormat[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 text-xs border transition-colors ${
                      format === f ? "border-black bg-black text-white" : "border-border hover:border-stone-400"
                    }`}
                  >
                    {f === "story" ? "Story 9:16" : "Post 1:1"}
                  </button>
                ))}
              </div>
            </div>

            {/* Template */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Template</p>
              <div className="flex gap-1.5">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => setTemplate(tmpl.id)}
                    title={tmpl.label}
                    className="flex-1 h-7 rounded-sm transition-all"
                    style={{
                      background: tmpl.bg,
                      color: tmpl.text,
                      outline: template === tmpl.id ? "2px solid #1a1a1a" : "none",
                      outlineOffset: 2,
                      fontSize: 9,
                      fontWeight: 600,
                    }}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Caption <span className="font-normal normal-case tracking-normal opacity-50">— optional</span>
              </p>
              <textarea
                value={caption}
                onChange={e => { setCaption(e.target.value); redraw(); }}
                placeholder="Add a personal note…"
                maxLength={120}
                rows={3}
                className="w-full text-sm border border-border px-3 py-2 resize-none bg-background focus:outline-none focus:border-black transition-colors placeholder:text-muted-foreground"
              />
              <p className="text-[10px] text-muted-foreground text-right">{caption.length} / 120</p>
            </div>

            {/* Options */}
            {payload.price && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={e => setShowPrice(e.target.checked)}
                  className="accent-black"
                />
                Show price
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 px-4 py-4 border-t border-border space-y-2">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-black text-white text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              {format === "story" ? "Save for Instagram Story" : "Save image"}
            </button>
            <button
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-2 border border-border text-sm hover:bg-muted transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link className="w-4 h-4" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

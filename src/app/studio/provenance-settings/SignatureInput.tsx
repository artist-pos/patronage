"use client";

import { useState, useRef, useEffect } from "react";
import type SignaturePad from "signature_pad";
import { createClient } from "@/lib/supabase/client";

type Mode = "upload" | "draw";

interface SignatureInputProps {
  userId: string;
  initialPath: string | null;
  initialSignedUrl: string | null;
  onSave: (path: string | null, signedUrl: string | null) => void;
}

export function SignatureInput({ userId, initialPath, initialSignedUrl, onSave }: SignatureInputProps) {
  const [mode, setMode] = useState<Mode>("upload");
  const [signedUrl, setSignedUrl] = useState<string | null>(initialSignedUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (mode !== "draw") return;
    let pad: SignaturePad | null = null;
    let mounted = true;

    (async () => {
      const { default: SignaturePadClass } = await import("signature_pad");
      if (!mounted || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad = new SignaturePadClass(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
      padRef.current = pad;
    })();

    return () => {
      mounted = false;
      pad?.off();
      padRef.current = null;
    };
  }, [mode]);

  async function uploadToStorage(file: File, ext: string): Promise<{ path: string; signedUrl: string }> {
    const path = `${userId}/signature.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("provenance-signatures")
      .upload(path, file, { upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);

    const { data: urlData, error: urlErr } = await supabase.storage
      .from("provenance-signatures")
      .createSignedUrl(path, 3600);
    if (urlErr || !urlData) throw new Error("Upload succeeded but could not generate preview URL");
    return { path, signedUrl: urlData.signedUrl };
  }

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) { setError("File must be under 2 MB"); return; }
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const result = await uploadToStorage(file, ext);
      setSignedUrl(result.signedUrl);
      onSave(result.path, result.signedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDrawSave() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) { setError("Please draw your signature first"); return; }
    setUploading(true);
    setError(null);
    try {
      const dataUrl = pad.toDataURL("image/png");
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "signature.png", { type: "image/png" });
      const result = await uploadToStorage(file, "png");
      setSignedUrl(result.signedUrl);
      onSave(result.path, result.signedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Saved preview */}
      {signedUrl && (
        <div className="flex items-start gap-4">
          <div
            className="rounded-lg border border-stone-200 bg-white flex items-center justify-center p-3"
            style={{ width: 220, height: 88 }}
          >
            <img src={signedUrl} alt="Saved signature" className="max-w-full max-h-full object-contain" />
          </div>
          <button
            type="button"
            onClick={() => { setSignedUrl(null); onSave(null, null); }}
            className="mt-2 text-xs text-stone-400 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex border border-stone-200 rounded-lg overflow-hidden w-fit">
        {(["upload", "draw"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${
              mode === m ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50"
            }`}
          >
            {m === "upload" ? "Upload" : "Draw"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div>
          <div
            className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-center hover:border-stone-300 transition-colors cursor-pointer"
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <p className="text-sm text-stone-400">Uploading…</p>
            ) : (
              <>
                <p className="text-sm text-stone-500">Drag & drop or click to upload</p>
                <p className="text-xs text-stone-400 mt-1">PNG or SVG · max 2 MB · transparent PNG recommended</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/svg+xml"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone-400">Draw your signature below using a mouse or touchscreen</p>
          <div
            className="border border-stone-200 rounded-xl overflow-hidden bg-white"
            style={{ cursor: "crosshair" }}
          >
            <canvas
              ref={canvasRef}
              style={{ display: "block", width: "100%", height: 160, touchAction: "none" }}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDrawSave}
              disabled={uploading}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {uploading ? "Saving…" : "Save signature"}
            </button>
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="px-4 py-2 border border-stone-200 text-stone-600 text-xs rounded-lg hover:bg-stone-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

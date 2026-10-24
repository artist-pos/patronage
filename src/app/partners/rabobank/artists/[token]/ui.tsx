"use client";

import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/rabobank/artist-copy";

export type SaveStatus = "idle" | "saving" | "saved" | "offline";

/**
 * Debounced autosave to the server, mirrored to localStorage on every change so
 * a closed phone browser (or a dropped connection) loses nothing.
 */
export function useAutosave<T>(value: T, key: string, save: (v: T) => Promise<{ ok: boolean }>, enabled: boolean) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const first = useRef(true);
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!enabled) return;
    try { localStorage.setItem(key, JSON.stringify({ v: value, at: new Date().toISOString() })); } catch { /* private mode */ }
    const t = window.setTimeout(async () => {
      setStatus("saving");
      try {
        const r = await saveRef.current(value);
        setStatus(r.ok ? "saved" : "offline");
      } catch {
        setStatus("offline");
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [value, key, enabled]);

  return status;
}

/** The local backup, if it is newer than what the server has. */
export function readBackup<T>(key: string, serverSavedAt: string | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { v, at } = JSON.parse(raw) as { v: T; at: string };
    if (serverSavedAt && new Date(at) <= new Date(serverSavedAt)) return null;
    return v;
  } catch {
    return null;
  }
}

/** Resize in the browser before upload (also turns HEIC into JPEG where the browser can read it). */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (scale === 1 && file.size < 3_500_000 && !heic) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function uploadImage<T = { url: string }>(token: string, kind: "work" | "photo" | "quote_existing", file: File): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: COPY.partTwo.errors.upload };
  const body = new FormData();
  const small = await shrink(file);
  body.set("file", small, small === file ? file.name : file.name.replace(/\.\w+$/, ".jpg"));
  body.set("kind", kind);
  try {
    const res = await fetch(`/partners/rabobank/artists/${token}/upload`, { method: "POST", body });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error ?? COPY.partTwo.errors.upload };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: COPY.partTwo.errors.upload };
  }
}

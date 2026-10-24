"use client";

import { useEffect, useRef, useState } from "react";
import { COPY } from "@/lib/rabobank/artist-copy";

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900/10 disabled:opacity-60";

export function Field({
  label,
  help,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block font-medium">
        {label}
        <span className="ml-2 text-xs font-normal text-stone-400">{required ? "Required" : "Optional"}</span>
      </label>
      {help && <p className="text-sm text-stone-500">{help}</p>}
      {children}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

/** A radio group drawn as pills. Nothing is selected until the artist chooses. */
export function Pills<T extends string>({
  name,
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  name: string;
  value: T | "";
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, text]) => (
        <label
          key={v}
          className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm transition-colors ${
            value === v ? "border-black bg-black text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-500"
          } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" disabled={disabled} />
          {text}
        </label>
      ))}
    </div>
  );
}

export function Counter({ value, max }: { value: string; max: number }) {
  return <p className={`text-right text-xs ${value.length > max ? "text-red-700" : "text-stone-400"}`}>{value.length}/{max}</p>;
}

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

export function SaveIndicator({ status }: { status: SaveStatus }) {
  const text = status === "saving" ? COPY.saving.saving : status === "saved" ? COPY.saving.saved : status === "offline" ? COPY.saving.offline : "";
  return <p className="min-h-5 text-sm text-stone-500" role="status" aria-live="polite">{text}</p>;
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
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: "That image is over 10 MB." };
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

export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-black px-6 font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40";
export const quietButton =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium hover:border-stone-500";

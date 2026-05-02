"use client";

import { useRef, useState } from "react";

export interface ParsedCertificate {
  title: string | null;
  artist: string | null;
  medium: string | null;
  year: number | null;
  dimensions: string | null;
  edition: string | null;
}

interface Props {
  onParsed: (parsed: ParsedCertificate) => void;
}

/**
 * Scan a paper certificate and pre-fill the upload form. The OCR is form
 * pre-fill only — the user reviews and edits every field before saving.
 * Tesseract is large (~3 MB) so it's loaded only when the user picks a file.
 */
export function OcrScanInput({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "eng");
      onParsed(parseCertificateText(data.text));
    } catch (err) {
      console.error(err);
      setError("Couldn't read that image. Try again or fill the form manually.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="border border-dashed border-stone-200 rounded-lg p-4 space-y-2">
      <p className="text-sm font-medium">Scan a paper certificate</p>
      <p className="text-xs text-muted-foreground">
        We&rsquo;ll read what we can and pre-fill the form. Review the details
        before saving — OCR isn&rsquo;t perfect.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        disabled={busy}
        className="text-xs"
      />
      {busy && <p className="text-xs text-muted-foreground">Reading image…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Heuristic field extraction. Most NZ/AU paper certificates use a "Field:
// value" layout, one per line. We don't try to parse free-form prose — if the
// pattern doesn't match, the field stays null and the user fills it.
function parseCertificateText(raw: string): ParsedCertificate {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const find = (...labels: string[]): string | null => {
    for (const line of lines) {
      const match = line.match(/^([A-Za-z\s/&]+?)\s*[:\-–]\s*(.+)$/);
      if (!match) continue;
      const label = match[1].toLowerCase().trim();
      if (labels.some((l) => label.includes(l))) {
        return match[2].trim() || null;
      }
    }
    return null;
  };

  const yearText = find("year", "date created", "created");
  const yearMatch = yearText?.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;

  return {
    title: find("title", "work", "artwork"),
    artist: find("artist", "by", "creator"),
    medium: find("medium", "material"),
    year,
    dimensions: find("dimensions", "size"),
    edition: find("edition"),
  };
}

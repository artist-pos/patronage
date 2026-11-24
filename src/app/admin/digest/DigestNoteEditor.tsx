"use client";

import { useState, useTransition } from "react";
import { saveDigestNoteAction } from "./actions";
import type { DigestNoteAudience } from "@/lib/digest-send";

const FIELDS: { key: DigestNoteAudience; label: string; goesIn: string }[] = [
  { key: "artist", label: "Note to artists", goesIn: "Both artist halves (Tuesday and Wednesday), then clears." },
  { key: "partner", label: "Note to organisations", goesIn: "The organisations’ digest, then clears." },
];

export function DigestNoteEditor({ initial }: { initial: Record<DigestNoteAudience, string> }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [result, setResult] = useState<{ key: DigestNoteAudience; ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(key: DigestNoteAudience) {
    startTransition(async () => {
      const res = await saveDigestNoteAction(key, values[key]);
      setResult({ key, ...res });
      if (res.ok) setSaved((s) => ({ ...s, [key]: values[key].trim() }));
    });
  }

  return (
    <div className="space-y-6 border-t border-border pt-10">
      <div className="space-y-1">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">A note from you</h2>
        <p className="text-xs text-muted-foreground">
          Optional. Appears above the picks in the next issue, then clears itself so an old announcement never repeats.
          Leave blank for a normal issue. Links become clickable; a blank line starts a new paragraph.
        </p>
      </div>

      {FIELDS.map(({ key, label, goesIn }) => {
        const dirty = values[key].trim() !== saved[key].trim();
        return (
          <div key={key} className="space-y-2">
            <label htmlFor={`note-${key}`} className="text-sm font-medium">
              {label}
            </label>
            <textarea
              id={`note-${key}`}
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              maxLength={2000}
              rows={5}
              placeholder="Kia ora. A short announcement, if there is one…"
              className="w-full border border-border bg-white px-3 py-2 text-sm leading-relaxed focus:outline-none focus:border-black"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => save(key)}
                disabled={pending || !dirty}
                className="border border-black px-3 py-1 text-xs hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pending ? "Saving…" : values[key].trim() ? "Save note" : "Remove note"}
              </button>
              <span className="text-[11px] text-muted-foreground">
                {saved[key] ? `Queued. ${goesIn}` : goesIn}
              </span>
              {result?.key === key && (
                <span className={`text-xs ${result.ok ? "" : "text-destructive"}`}>{result.message}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

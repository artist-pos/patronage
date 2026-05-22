"use client";

import { FileUp } from "lucide-react";
import { ARTIST_DOC_OPTIONS } from "@/lib/opportunity-constants";
import type { PipelineQuestion, PipelineConfig } from "@/types/database";

interface Props {
  questions: PipelineQuestion[];
  artistDocs: PipelineConfig["artist_documents"];
  showBadges: boolean;
}

export function LivePreviewPane({ questions, artistDocs, showBadges }: Props) {
  const selectedDocs = ARTIST_DOC_OPTIONS.filter((d) =>
    (artistDocs as string[]).includes(d.val)
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Preview</p>
        <p className="text-[11px] text-stone-400">How artists will see your application form.</p>
      </div>

      <div className="border border-black/10 bg-stone-50 p-5 space-y-5">
        {questions.length === 0 && (
          <p className="text-xs text-stone-400 text-center py-4">
            Add questions on the left to see a preview.
          </p>
        )}

        {questions.map((q, i) => (
          <div key={q.id} className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              {q.label || `Question ${i + 1}`}
              {q.required && <span className="text-stone-400 ml-1">*</span>}
            </label>
            {q.type === "long_text" && (
              <div className="w-full border border-black/20 bg-white px-3 py-2 text-xs text-stone-400 min-h-[80px]">
                Long answer…
              </div>
            )}
            {q.type === "short_text" && (
              <div className="w-full border border-black/20 bg-white px-3 py-2 text-xs text-stone-400">
                Short answer…
              </div>
            )}
            {q.type === "file_upload" && (
              <div className="flex items-center gap-2 border border-dashed border-black/20 bg-white px-4 py-3 text-xs text-stone-400">
                <FileUp className="w-3.5 h-3.5 shrink-0" />
                Upload file
              </div>
            )}
          </div>
        ))}

        {selectedDocs.length > 0 && (
          <div className="border-t border-black/10 pt-4 space-y-1.5">
            <p className="text-xs font-medium text-stone-500">Pulled from your Patronage profile:</p>
            <ul className="space-y-1">
              {selectedDocs.map((d) => (
                <li key={d.val} className="text-xs text-stone-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
                  {d.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {showBadges && (
          <div className="border-t border-black/10 pt-4">
            <p className="text-[11px] text-stone-400">Reputation badges will be shown alongside submission.</p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { FileUp, Upload } from "lucide-react";
import { ARTIST_DOC_OPTIONS, ARTIST_DOC_AUTO_VALS, ARTIST_DOC_PICKER_VALS } from "@/lib/opportunity-constants";
import type { PipelineQuestion, PipelineConfig } from "@/types/database";

interface Props {
  questions: PipelineQuestion[];
  artistDocs: PipelineConfig["artist_documents"];
  showBadges: boolean;
  portfolioPickCount: number;
  workDescriptionsEnabled: boolean;
}

export function LivePreviewPane({ questions, artistDocs, showBadges, portfolioPickCount, workDescriptionsEnabled }: Props) {
  const docVals = artistDocs as string[];
  const autoDocs = ARTIST_DOC_OPTIONS.filter((d) => docVals.includes(d.val) && (ARTIST_DOC_AUTO_VALS as string[]).includes(d.val));
  const pickerDocs = ARTIST_DOC_OPTIONS.filter((d) => docVals.includes(d.val) && (ARTIST_DOC_PICKER_VALS as string[]).includes(d.val));
  const showsPortfolio = docVals.includes("portfolio");
  const showsAvailableWorks = docVals.includes("available_works");
  // One placeholder tile per available-work pick (single) + one per portfolio pick (up to portfolioPickCount)
  const placeholderTileCount = (showsAvailableWorks ? 1 : 0) + (showsPortfolio ? portfolioPickCount : 0);

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

        {autoDocs.length > 0 && (
          <div className="border-t border-black/10 pt-4 space-y-1.5">
            <p className="text-xs font-medium text-stone-500">Auto-included from their profile:</p>
            <ul className="space-y-1">
              {autoDocs.map((d) => (
                <li key={d.val} className="text-xs text-stone-400 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-stone-300 shrink-0" />
                  {d.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pickerDocs.length > 0 && (
          <div className="border-t border-black/10 pt-4 space-y-2">
            <p className="text-xs font-medium text-stone-500">
              Submit a work
              {showsPortfolio && ` — artist picks up to ${portfolioPickCount} portfolio work${portfolioPickCount !== 1 ? "s" : ""}`}
              {showsPortfolio && showsAvailableWorks && ", plus"}
              {showsAvailableWorks && " one available (for-sale) work"}:
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              <div className="aspect-square border border-black bg-muted flex items-center justify-center text-[8px] text-stone-400">
                None
              </div>
              <div className="aspect-square border border-dashed border-black/30 bg-white flex items-center justify-center">
                <Upload className="w-3 h-3 text-stone-300" />
              </div>
              {Array.from({ length: placeholderTileCount }).map((_, i) => (
                <div key={i} className="aspect-square border border-black/20 bg-stone-100" />
              ))}
            </div>
            <p className="text-[10px] text-stone-400">
              {pickerDocs.map((d) => d.label).join(" / ")}
            </p>
            {workDescriptionsEnabled && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-stone-400">
                  Required for each work they attach<span className="text-[color:var(--urgent)]">*</span>
                </p>
                <div className="border border-black/20 bg-white px-3 py-2 text-[10px] text-stone-400">
                  Description of this work…
                </div>
              </div>
            )}
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

"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { saveCertificateNote } from "./actions";

const LogSaleModal = dynamic(() => import("./LogSaleModal").then(m => ({ default: m.LogSaleModal })), { ssr: false });
const CertificatePdfModal = dynamic(
  () => import("@/components/provenance/CertificatePdfModal").then(m => ({ default: m.CertificatePdfModal })),
  { ssr: false }
);

export interface TransferredWork {
  id: string;
  title: string | null;
  url: string | null;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  certificate_note: string | null;
  ledger_id: string | null;
  buyer_name: string;
  transfer_date: string | null;
  created_at: string;
  doc_photo_count: number;
}

interface Props {
  works: TransferredWork[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" });
}

function ProvenanceRow({ work: initial }: { work: TransferredWork }) {
  const [work, setWork] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(work.certificate_note ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCert, setShowCert] = useState(false);

  const isPublished = !!work.certificate_note;

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const result = await saveCertificateNote(work.id, note);
    setSaving(false);
    if (result.error) {
      setSaveError(result.error);
    } else {
      setWork(prev => ({ ...prev, certificate_note: note.trim() || null }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (!note.trim()) setExpanded(false);
    }
  }

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-stone-100 flex-shrink-0 overflow-hidden">
          {work.url ? (
            <img src={work.url} alt={work.title ?? "Work"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-300">
              <svg className="w-6 h-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium text-stone-900 truncate">{work.title ?? "Untitled"}</p>
          <p className="text-xs text-stone-500">
            {[work.medium, work.year].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-stone-500">
            Transferred to <span className="font-medium text-stone-700">{work.buyer_name}</span>
            {work.transfer_date && ` · ${formatDate(work.transfer_date)}`}
          </p>
          {/* Lenient completeness footnote — not blocking, just a nudge.
              "Manage details" jumps to the per-artwork page where the artist
              can fill in medium/dimensions, upload doc photos, and log prior
              history. */}
          <p className="text-[11px] text-stone-400">
            {work.certificate_note ? "Statement added" : "Statement missing"}
            {" · "}
            {work.doc_photo_count}/4 photos
            {(!work.medium || !work.dimensions) && " · "}
            {!work.medium && "Missing medium"}
            {!work.medium && !work.dimensions && " · "}
            {!work.dimensions && "Missing dimensions"}
            {" · "}
            <Link
              href={`/studio/artworks/${work.id}`}
              className="underline underline-offset-2 hover:text-stone-700 transition-colors"
            >
              Manage details
            </Link>
          </p>
          {work.ledger_id && (
            <a
              href={`/provenance/${work.ledger_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] font-mono text-stone-400 hover:text-stone-700 transition-colors"
            >
              {work.ledger_id}
            </a>
          )}
        </div>

        {/* State + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`text-[10px] font-medium uppercase tracking-wide px-2.5 py-0.5 rounded-full ${
            isPublished
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {isPublished ? "Statement added" : "Needs statement"}
          </span>
          <div className="flex items-center gap-2">
            {work.ledger_id && (
              <button
                type="button"
                onClick={() => setShowCert(true)}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors underline"
              >
                View cert
              </button>
            )}
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="text-xs text-stone-700 hover:text-stone-900 transition-colors underline"
            >
              {expanded ? "Close" : isPublished ? "Edit statement" : "Add statement"}
            </button>
          </div>
        </div>
      </div>

      {showCert && work.ledger_id && (
        <CertificatePdfModal
          pdfUrl={`/api/provenance/certificate?artworkId=${work.id}`}
          filename={`provenance-${work.ledger_id}.pdf`}
          onClose={() => setShowCert(false)}
        />
      )}

      {/* Inline statement editor */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-100 pt-4 space-y-3 bg-stone-50">
          <p className="text-xs text-stone-500">
            This statement appears on the provenance certificate as an artist note about the work.
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. This work was created during a period of sustained studio practice in 2024…"
            rows={3}
            className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save statement"}
            </button>
            {saved && <p className="text-xs text-emerald-600">Saved.</p>}
            {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProvenanceList({ works }: Props) {
  const [showLogSale, setShowLogSale] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">Sold &amp; transferred works</h2>
          <p className="text-xs text-stone-500">
            {works.length === 0
              ? "No transfers recorded yet."
              : `${works.length} work${works.length !== 1 ? "s" : ""} transferred`}
          </p>
        </div>
        <button
          onClick={() => setShowLogSale(true)}
          className="flex items-center gap-1.5 px-4 py-2 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Log a sale
        </button>
      </div>

      {works.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-stone-200 rounded-xl space-y-3">
          <p className="text-sm text-stone-500">
            Works you transfer to collectors will appear here with their provenance records.
          </p>
          <button
            onClick={() => setShowLogSale(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors"
          >
            Log a past sale →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {works.map(w => (
            <ProvenanceRow key={w.id} work={w} />
          ))}
        </div>
      )}

      {showLogSale && <LogSaleModal onClose={() => setShowLogSale(false)} />}
    </>
  );
}

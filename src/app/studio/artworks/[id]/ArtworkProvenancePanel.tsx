"use client";

import { useState } from "react";
import { resolveOwnershipClaim, initiateDirectTransfer } from "@/app/dashboard/provenance-actions";
import { createClient } from "@/lib/supabase/client";

interface ArtworkData {
  id: string;
  title: string;
  url: string | null;
  certificate_note: string | null;
  ledger_id: string | null;
  is_available: boolean;
  current_owner_id: string;
  creator_id: string;
}

interface Claim {
  id: string;
  claimer_name: string;
  claimer_email: string;
  claimed_at: string;
}

interface LedgerEntry {
  id: string;
  entry_type: string;
  transfer_method: string;
  transferred_at: string;
  owner_name: string;
}

interface Props {
  artwork: ArtworkData;
  pendingClaims: Claim[];
  ledgerEntries: LedgerEntry[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" });
}

export function ArtworkProvenancePanel({ artwork, pendingClaims: initialClaims, ledgerEntries }: Props) {
  const [note, setNote] = useState(artwork.certificate_note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  const [claims, setClaims] = useState(initialClaims);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [showTransfer, setShowTransfer] = useState(false);
  const [transferName, setTransferName] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [transferPrice, setTransferPrice] = useState("");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferred, setTransferred] = useState(false);

  const supabase = createClient();

  async function saveNote() {
    setSavingNote(true);
    setNoteError(null);
    const { error } = await supabase
      .from("artworks")
      .update({ certificate_note: note.trim() || null })
      .eq("id", artwork.id);
    setSavingNote(false);
    if (error) {
      setNoteError(error.message);
    } else {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 3000);
    }
  }

  async function handleClaim(claimId: string, action: "approve" | "decline") {
    setResolvingId(claimId);
    setResolveError(null);
    const result = await resolveOwnershipClaim(claimId, action);
    setResolvingId(null);
    if (result.error) {
      setResolveError(result.error);
    } else {
      setClaims(prev => prev.filter(c => c.id !== claimId));
      if (action === "approve") setTransferred(true);
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTransferring(true);
    setTransferError(null);
    const result = await initiateDirectTransfer(
      artwork.id,
      transferName.trim(),
      transferEmail.trim(),
      transferPrice ? parseFloat(transferPrice) : null,
      transferNotes.trim() || null,
    );
    setTransferring(false);
    if (result.error) {
      setTransferError(result.error);
    } else {
      setShowTransfer(false);
      setTransferred(true);
    }
  }

  const isTransferred = transferred || (!artwork.is_available && artwork.current_owner_id !== artwork.creator_id);

  return (
    <div className="space-y-10">

      {/* Certificate note */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Certificate statement</h2>
          <p className="text-xs text-stone-400 mt-1">
            Appears on the provenance certificate as an artist statement or note about this work.
          </p>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. This work was created during a period of sustained studio practice in 2024…"
          rows={4}
          className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={saveNote}
            disabled={savingNote}
            className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {savingNote ? "Saving…" : "Save note"}
          </button>
          {noteSaved && <p className="text-xs text-emerald-600">Saved.</p>}
          {noteError && <p className="text-xs text-red-600">{noteError}</p>}
        </div>
      </section>

      {/* Ownership transfer */}
      <section className="space-y-4 border-t border-stone-100 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Transfer ownership</h2>
            <p className="text-xs text-stone-400 mt-1">
              Register a new owner. A provenance certificate will be emailed to them.
            </p>
          </div>
          {artwork.ledger_id && (
            <a
              href={`/api/provenance/certificate?artworkId=${artwork.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-xs text-stone-400 hover:text-stone-700 transition-colors underline"
            >
              Download certificate
            </a>
          )}
        </div>

        {isTransferred ? (
          <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            This work has been transferred. The provenance certificate has been sent.
          </div>
        ) : showTransfer ? (
          <form onSubmit={handleTransfer} className="space-y-4 bg-stone-50 border border-stone-200 rounded-xl p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Buyer name</label>
                <input
                  type="text"
                  required
                  value={transferName}
                  onChange={e => setTransferName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Buyer email</label>
                <input
                  type="email"
                  required
                  value={transferEmail}
                  onChange={e => setTransferEmail(e.target.value)}
                  placeholder="buyer@example.com"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Sale price <span className="text-stone-400 font-normal">(optional, NZD)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferPrice}
                  onChange={e => setTransferPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1.5">
                  Notes <span className="text-stone-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder="Private ledger note"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>
            </div>
            {transferError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{transferError}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={transferring}
                className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {transferring ? "Transferring…" : "Confirm transfer"}
              </button>
              <button
                type="button"
                onClick={() => setShowTransfer(false)}
                className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowTransfer(true)}
            className="px-4 py-2.5 border border-stone-200 text-stone-700 text-sm rounded-lg hover:bg-stone-50 transition-colors"
          >
            Transfer ownership…
          </button>
        )}
      </section>

      {/* Pending claims */}
      {claims.length > 0 && (
        <section className="space-y-4 border-t border-stone-100 pt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Ownership claims</h2>
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">
              {claims.length} pending
            </span>
          </div>
          <p className="text-xs text-stone-400">
            Someone has submitted a claim saying they own this work. Approve to transfer ownership, or decline if the claim is invalid.
          </p>
          {resolveError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{resolveError}</p>
          )}
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
            {claims.map(claim => (
              <div key={claim.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-stone-800">{claim.claimer_name}</p>
                  <p className="text-xs text-stone-500">{claim.claimer_email}</p>
                  <p className="text-xs text-stone-400 mt-0.5">{formatDate(claim.claimed_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleClaim(claim.id, "approve")}
                    disabled={resolvingId === claim.id}
                    className="px-3 py-1.5 bg-stone-900 text-white text-xs rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleClaim(claim.id, "decline")}
                    disabled={resolvingId === claim.id}
                    className="px-3 py-1.5 border border-stone-200 text-stone-600 text-xs rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ledger history */}
      {ledgerEntries.length > 0 && (
        <section className="space-y-4 border-t border-stone-100 pt-8">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Provenance record</h2>
          <ol className="relative border-l border-stone-200 space-y-0">
            {ledgerEntries.map((entry, idx) => {
              const isLast = idx === ledgerEntries.length - 1;
              const label =
                entry.entry_type === "created" ? "Created & registered" :
                entry.entry_type === "transferred" && entry.transfer_method === "claim" ? "Transferred via claim" :
                "Transferred";
              return (
                <li key={entry.id} className="ml-5 pb-5">
                  <div className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 ${isLast ? "border-stone-900 bg-stone-900" : "border-stone-300 bg-white"}`} />
                  <p className="text-[11px] text-stone-400">{formatDate(entry.transferred_at)}</p>
                  <p className="text-sm font-medium text-stone-800">{label}</p>
                  <p className="text-xs text-stone-500">{entry.owner_name}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

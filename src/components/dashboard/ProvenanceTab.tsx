"use client";

import { useState } from "react";
import Link from "next/link";
import { resolveOwnershipClaim, initiateDirectTransfer } from "@/app/dashboard/provenance-actions";
import type { ArtworkProvenanceSummary, PendingClaim } from "@/lib/provenance";

interface LedgerEvent {
  id: string;
  artwork_id: string;
  entry_type: string;
  transfer_method: string;
  transferred_at: string;
  artwork_title: string | null;
}

interface Props {
  artworks: ArtworkProvenanceSummary[];
  pendingClaims: (PendingClaim & { artwork_title: string | null; artwork_url: string })[];
  recentActivity: LedgerEvent[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", { year: "numeric", month: "short", day: "numeric" });
}

// ── Direct transfer modal ─────────────────────────────────────────────────────

function DirectTransferModal({
  artwork,
  onClose,
  onSuccess,
}: {
  artwork: ArtworkProvenanceSummary;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await initiateDirectTransfer(
      artwork.id,
      name.trim(),
      email.trim(),
      price ? parseFloat(price) : null,
      notes.trim() || null,
    );
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      onSuccess();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <h3 className="text-base font-semibold text-stone-900 mb-1">Transfer ownership</h3>
        <p className="text-sm text-stone-500 mb-5">
          Transfer <span className="font-medium text-stone-700">{artwork.title ?? "Untitled"}</span> to a new owner.
          A provenance certificate will be emailed to them.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Buyer name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">Buyer email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="buyer@example.com"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Sale price <span className="text-stone-400 font-normal">(optional, NZD)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1.5">
              Notes <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Private notes for the ledger record…"
              rows={2}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {submitting ? "Transferring…" : "Transfer ownership"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main tab component ────────────────────────────────────────────────────────

export function ProvenanceTab({ artworks, pendingClaims: initialClaims, recentActivity }: Props) {
  const [transferArtwork, setTransferArtwork] = useState<ArtworkProvenanceSummary | null>(null);
  const [transferDone, setTransferDone] = useState<string | null>(null); // artworkId
  const [claims, setClaims] = useState(initialClaims);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function handleClaim(claimId: string, action: "approve" | "decline") {
    setResolvingId(claimId);
    setResolveError(null);
    const result = await resolveOwnershipClaim(claimId, action);
    setResolvingId(null);
    if (result.error) {
      setResolveError(result.error);
    } else {
      setClaims(prev => prev.filter(c => c.id !== claimId));
    }
  }

  const artworksAvailable = artworks.filter(a => a.is_available && a.creator_id === a.current_owner_id);
  const artworksTransferred = artworks.filter(a => !a.is_available || a.current_owner_id !== a.creator_id);

  return (
    <div className="space-y-12">

      {/* Pending claims */}
      {claims.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
              Pending Claims
            </p>
            <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2.5 py-0.5 font-medium">
              {claims.length} pending
            </span>
          </div>
          {resolveError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{resolveError}</p>
          )}
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
            {claims.map(claim => (
              <div key={claim.id} className="p-4 flex items-start gap-4">
                {claim.artwork_url && (
                  <img
                    src={claim.artwork_url}
                    alt={claim.artwork_title ?? ""}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-stone-100"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">
                    {claim.artwork_title ?? "Untitled"}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {claim.claimer_name} · {claim.claimer_email}
                  </p>
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

      {/* Available works (with transfer CTA) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Your Works
          </p>
          <Link
            href="/dashboard/provenance-settings"
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
          >
            Certificate settings →
          </Link>
        </div>

        {artworks.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-stone-200 rounded-xl">
            <p className="text-sm text-stone-400">No works registered yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
            {artworks.map(artwork => {
              const transferred = !artwork.is_available || artwork.current_owner_id !== artwork.creator_id;
              const isDone = transferDone === artwork.id;
              return (
                <div key={artwork.id} className="p-4 flex items-center gap-4">
                  {artwork.url && (
                    <img
                      src={artwork.url}
                      alt={artwork.title ?? ""}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-stone-100"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">
                      {artwork.title ?? "Untitled"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {artwork.ledger_id ? (
                        <Link
                          href={`/provenance/${artwork.ledger_id}`}
                          className="text-xs font-mono text-stone-400 hover:text-stone-700 transition-colors"
                        >
                          {artwork.ledger_id}
                        </Link>
                      ) : (
                        <span className="text-xs text-stone-300">No ledger yet</span>
                      )}
                      {artwork.custody_count > 0 && (
                        <span className="text-xs text-stone-400">
                          · {artwork.custody_count} event{artwork.custody_count !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${
                      transferred || isDone
                        ? "bg-stone-100 text-stone-400"
                        : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {transferred || isDone ? "Transferred" : "Held"}
                    </span>
                    {!transferred && !isDone && (
                      <button
                        onClick={() => setTransferArtwork(artwork)}
                        className="text-xs px-3 py-1.5 border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors"
                      >
                        Transfer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Recent Activity
          </p>
          <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
            {recentActivity.map(event => (
              <div key={event.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-stone-700 truncate">
                    {event.artwork_title ?? "Untitled"}
                  </p>
                  <p className="text-xs text-stone-400 capitalize">
                    {event.entry_type === "created" ? "Registered" : event.entry_type}
                    {event.transfer_method === "claim" ? " via claim" : ""}
                  </p>
                </div>
                <p className="text-xs text-stone-400 shrink-0">{formatDate(event.transferred_at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Transfer modal */}
      {transferArtwork && (
        <DirectTransferModal
          artwork={transferArtwork}
          onClose={() => setTransferArtwork(null)}
          onSuccess={() => {
            setTransferDone(transferArtwork.id);
            setTransferArtwork(null);
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  toggleOpportunityActive,
  deleteOpportunity,
  createDraftUnclaimedListing,
  generateClaimToken,
} from "@/app/admin/opportunities/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AdminEditOpportunityModal } from "@/components/opportunities/AdminEditOpportunityModal";
import { X } from "lucide-react";
import type { Opportunity } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-green-100 text-green-800",
    draft: "bg-yellow-100 text-yellow-800",
    draft_unclaimed: "bg-blue-100 text-blue-800",
    pending: "bg-stone-100 text-stone-600",
    rejected: "bg-red-100 text-red-800",
  };
  const cls = map[status] ?? "bg-stone-100 text-stone-600";
  const label = status === "draft_unclaimed" ? "unclaimed" : status;
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

interface ClaimState {
  token: string | null;
  email: string | null;
  emailInput: string;
  loading: boolean;
  copied: boolean;
}

export function OpportunityTable({ opps }: { opps: Opportunity[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);
  const [editTarget, setEditTarget] = useState<Opportunity | null>(null);
  const [newListingPending, setNewListingPending] = useState(false);
  const [claimTargetId, setClaimTargetId] = useState<string | null>(null);

  const [claimState, setClaimState] = useState<Record<string, ClaimState>>(
    () =>
      Object.fromEntries(
        opps.map((o) => [
          o.id,
          {
            token: o.claim_token ?? null,
            email: o.claim_email ?? null,
            emailInput: o.claim_email ?? "",
            loading: false,
            copied: false,
          },
        ])
      )
  );

  const today = new Date().toISOString().split("T")[0];

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  function updateClaim(id: string, updates: Partial<ClaimState>) {
    setClaimState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { token: null, email: null, emailInput: "", loading: false, copied: false }),
        ...updates,
      },
    }));
  }

  async function handleGenerateToken(id: string) {
    const email = claimState[id]?.emailInput?.trim() || undefined;
    updateClaim(id, { loading: true });
    try {
      const result = await generateClaimToken(id, email);
      updateClaim(id, { token: result.claim_token, email: email ?? null, loading: false });
    } catch {
      updateClaim(id, { loading: false });
    }
  }

  async function handleNewListing() {
    setNewListingPending(true);
    try {
      const newOpp = await createDraftUnclaimedListing();
      setClaimState((prev) => ({
        ...prev,
        [newOpp.id]: { token: null, email: null, emailInput: "", loading: false, copied: false },
      }));
      setEditTarget(newOpp);
      router.refresh();
    } finally {
      setNewListingPending(false);
    }
  }

  function copyClaimUrl(id: string) {
    const token = claimState[id]?.token;
    if (!token) return;
    navigator.clipboard.writeText(`${SITE_URL}/claim-listing/${token}`).then(() => {
      updateClaim(id, { copied: true });
      setTimeout(() => updateClaim(id, { copied: false }), 2000);
    });
  }

  const claimOpp = claimTargetId ? opps.find((o) => o.id === claimTargetId) ?? null : null;
  const claim = claimTargetId ? claimState[claimTargetId] : null;
  const claimUrl = claim?.token ? `${SITE_URL}/claim-listing/${claim.token}` : null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-end mb-4">
        <Button
          size="sm"
          variant="outline"
          disabled={newListingPending}
          onClick={handleNewListing}
          className="text-xs h-7 px-3"
        >
          {newListingPending ? "Creating…" : "+ New listing for partner"}
        </Button>
      </div>

      <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 pr-4 font-medium text-muted-foreground">Title</th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">Type</th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">Country</th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">Deadline</th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">Status</th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">Actions</th>
                <th className="py-3 pr-4 font-medium text-muted-foreground">Claim</th>
                <th className="py-3 font-medium text-muted-foreground">Report</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => {
                const expired = o.deadline && o.deadline < today;
                const isSelected = claimTargetId === o.id;
                const hasToken = !!(claimState[o.id]?.token);

                return (
                  <tr
                    key={o.id}
                    className={`border-b border-border transition-colors ${isSelected ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="py-3 pr-4 max-w-[200px]">
                      <span className="line-clamp-1">{o.title}</span>
                      <span className="text-muted-foreground block truncate">{o.organiser}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="text-xs font-normal">{o.type}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{o.country}</td>
                    <td className="py-3 pr-4">
                      <span className={expired ? "text-destructive" : "text-muted-foreground"}>
                        {o.deadline ?? "Open"}{expired && " (expired)"}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant={o.is_active ? "outline" : "default"}
                          disabled={isPending}
                          onClick={() => act(() => toggleOpportunityActive(o.id, o.is_active))}
                          className="text-xs h-7 px-2"
                        >
                          {o.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => setDeleteTarget(o)}
                          className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => setClaimTargetId(isSelected ? null : o.id)}
                        className={`text-xs px-2 py-1 border transition-colors ${
                          isSelected
                            ? "border-black bg-black text-white"
                            : hasToken
                            ? "border-green-600 text-green-700 hover:bg-green-50"
                            : "border-black/40 text-muted-foreground hover:border-black hover:text-foreground"
                        }`}
                      >
                        {hasToken ? "Link ready" : "Claim link"}
                      </button>
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/opportunities/${o.id}/report`}
                        className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Report →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {opps.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No opportunities yet.</p>
          )}
        </div>

      {/* ── Claim modal ──────────────────────────────────────────────────── */}
      {claimOpp && claim && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setClaimTargetId(null); }}
        >
          <div className="bg-background border border-black w-full max-w-sm mx-4 shadow-lg">
            <div className="flex items-start justify-between px-5 py-4 border-b border-black/20">
              <div className="min-w-0 pr-3">
                <p className="text-xs font-semibold uppercase tracking-widest mb-0.5">Claim link</p>
                <p className="text-xs text-muted-foreground truncate">{claimOpp.title}</p>
              </div>
              <button
                onClick={() => setClaimTargetId(null)}
                className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {claimUrl ? (
                <>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Send this URL to the organisation:</p>
                    <input
                      readOnly
                      value={claimUrl}
                      className="w-full border border-border bg-muted/30 px-2 py-1.5 text-xs font-mono text-muted-foreground focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyClaimUrl(claimOpp.id)}
                      className="w-full text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
                    >
                      {claim.copied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                  {claim.email && (
                    <p className="text-xs text-muted-foreground">For: {claim.email}</p>
                  )}
                  <div className="border-t border-black/10 pt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Regenerate with a different email:</p>
                    <input
                      type="email"
                      placeholder="partner@organisation.nz"
                      value={claim.emailInput}
                      onChange={(e) => updateClaim(claimOpp.id, { emailInput: e.target.value })}
                      className="w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-black"
                    />
                    <button
                      type="button"
                      disabled={claim.loading}
                      onClick={() => handleGenerateToken(claimOpp.id)}
                      className="w-full text-xs border border-black/40 px-3 py-1.5 hover:border-black transition-colors disabled:opacity-50"
                    >
                      {claim.loading ? "Generating…" : "Regenerate"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Generate a unique link for the organisation to claim this listing and create their partner account.
                  </p>
                  <input
                    type="email"
                    placeholder="partner@organisation.nz (optional)"
                    value={claim.emailInput}
                    onChange={(e) => updateClaim(claimOpp.id, { emailInput: e.target.value })}
                    className="w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    disabled={claim.loading}
                    onClick={() => handleGenerateToken(claimOpp.id)}
                    className="w-full text-xs border border-black bg-black text-white px-3 py-1.5 hover:bg-white hover:text-black transition-colors disabled:opacity-50"
                  >
                    {claim.loading ? "Generating…" : "Generate claim link"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — triggered after creating a new draft */}
      {editTarget && (
        <AdminEditOpportunityModal
          key={editTarget.id}
          opp={editTarget}
          forceOpen
          onForceClose={() => setEditTarget(null)}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete opportunity</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong> by{" "}
              {deleteTarget?.organiser}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isPending}
              onClick={() => {
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                act(() => deleteOpportunity(id));
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

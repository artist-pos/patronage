"use client";

import { useTransition, useState, Fragment } from "react";
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

interface ClaimRowState {
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

  // Per-row claim state
  const [claimState, setClaimState] = useState<Record<string, ClaimRowState>>(
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

  function updateClaim(id: string, updates: Partial<ClaimRowState>) {
    setClaimState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { token: null, email: null, emailInput: "", loading: false, copied: false }), ...updates },
    }));
  }

  async function handleGenerateToken(o: Opportunity) {
    const email = claimState[o.id]?.emailInput?.trim() || undefined;
    updateClaim(o.id, { loading: true });
    try {
      const result = await generateClaimToken(o.id, email);
      updateClaim(o.id, { token: result.claim_token, email: email ?? null, loading: false });
    } catch {
      updateClaim(o.id, { loading: false });
    }
  }

  async function handleNewListing() {
    setNewListingPending(true);
    try {
      const newOpp = await createDraftUnclaimedListing();
      // Add claim state entry for new opp
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
              <th className="py-3 font-medium text-muted-foreground">Report</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => {
              const expired = o.deadline && o.deadline < today;
              const claim = claimState[o.id];
              const isUnclaimed = !o.profile_id;
              const claimUrl = claim?.token
                ? `${SITE_URL}/claim-listing/${claim.token}`
                : null;

              return (
                <Fragment key={o.id}>
                  <tr className="border-b border-border">
                    <td className="py-3 pr-4 max-w-[220px]">
                      <span className="line-clamp-1">{o.title}</span>
                      <span className="text-muted-foreground block truncate">
                        {o.organiser}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline" className="text-xs font-normal">
                        {o.type}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{o.country}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          expired ? "text-destructive" : "text-muted-foreground"
                        }
                      >
                        {o.deadline ?? "Open"}
                        {expired && " (expired)"}
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
                          onClick={() =>
                            act(() => toggleOpportunityActive(o.id, o.is_active))
                          }
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
                    <td className="py-3">
                      <Link
                        href={`/admin/opportunities/${o.id}/report`}
                        className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Report →
                      </Link>
                    </td>
                  </tr>

                  {/* Claim link sub-row — only for unclaimed listings */}
                  {isUnclaimed && claim && (
                    <tr className="border-b border-border bg-blue-50/20">
                      <td colSpan={7} className="px-3 py-2.5">
                        {claimUrl ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground text-xs shrink-0">Claim link:</span>
                            <input
                              readOnly
                              value={claimUrl}
                              className="flex-1 min-w-0 border border-border bg-background px-2 py-1 text-xs font-mono text-muted-foreground focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => copyClaimUrl(o.id)}
                              className="text-xs border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors shrink-0"
                            >
                              {claim.copied ? "Copied!" : "Copy"}
                            </button>
                            {claim.email && (
                              <span className="text-xs text-muted-foreground">→ {claim.email}</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-muted-foreground text-xs shrink-0">Generate claim link:</span>
                            <input
                              type="email"
                              placeholder="Partner email (optional)"
                              value={claim.emailInput}
                              onChange={(e) => updateClaim(o.id, { emailInput: e.target.value })}
                              className="border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:border-black w-48"
                            />
                            <button
                              type="button"
                              disabled={claim.loading}
                              onClick={() => handleGenerateToken(o)}
                              className="text-xs border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors disabled:opacity-50"
                            >
                              {claim.loading ? "Generating…" : "Generate"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No opportunities yet.
          </p>
        )}
      </div>

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

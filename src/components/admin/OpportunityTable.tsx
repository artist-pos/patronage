"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  toggleOpportunityActive,
  toggleOpportunityFeatured,
  deleteOpportunity,
  createDraftUnclaimedListing,
  generateClaimToken,
  regenerateOpportunitySlug,
} from "@/app/admin/opportunities/actions";
import { isSlugBad } from "@/lib/opportunity-slug";
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
import { X, Mail, Search, Star, Settings } from "lucide-react";
import { ClaimInvitePanel } from "@/components/admin/ClaimInvitePanel";
import { BulkClaimPanel } from "@/components/admin/BulkClaimPanel";
import type { Opportunity } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

type ClaimStatus = "none" | "scheduled" | "sent" | "opened" | "claimed";
type ClaimFilter = "all" | ClaimStatus;

function getClaimStatus(o: Opportunity): ClaimStatus {
  // "claimed" only when an org went through the claim-link flow
  // (profile_id set by a partner submission alone doesn't count)
  if (o.profile_id && o.claim_token) return "claimed";
  if (o.claim_link_opened_at) return "opened";
  if (o.claim_invite_sent_at) return "sent";
  if (o.claim_invite_scheduled_for) return "scheduled";
  return "none";
}

function ClaimStatusBadge({ opp }: { opp: Opportunity }) {
  const status = getClaimStatus(opp);

  const styles: Record<ClaimStatus, string> = {
    none: "text-muted-foreground",
    scheduled: "bg-blue-50 text-blue-700 border border-blue-200",
    sent: "bg-stone-100 text-stone-600 border border-stone-200",
    opened: "bg-amber-50 text-amber-700 border border-amber-200",
    claimed: "bg-green-100 text-green-700 border border-green-200",
  };

  const labels: Record<ClaimStatus, string> = {
    none: "—",
    scheduled: "Scheduled",
    sent: "Sent",
    opened: "Opened",
    claimed: "Claimed",
  };

  let tooltip = "";
  if (status === "scheduled" && opp.claim_invite_scheduled_for) {
    tooltip = `Scheduled for ${new Date(opp.claim_invite_scheduled_for).toLocaleString("en-NZ")}`;
  } else if (status === "sent" && opp.claim_invite_sent_at) {
    tooltip = `Sent ${new Date(opp.claim_invite_sent_at).toLocaleString("en-NZ")}`;
    if (opp.claim_invite_email) tooltip += ` to ${opp.claim_invite_email}`;
  } else if (status === "opened" && opp.claim_link_opened_at) {
    tooltip = `First opened ${new Date(opp.claim_link_opened_at).toLocaleString("en-NZ")}`;
    if (opp.claim_link_open_count > 1) tooltip += ` · ${opp.claim_link_open_count} opens`;
  } else if (status === "claimed") {
    tooltip = "Listing has been claimed by an organisation";
  }

  if (status === "none") {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <span
      title={tooltip || undefined}
      className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium cursor-default ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

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

  // Claim invite state
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("all");
  const [search, setSearch] = useState("");

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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(visibleIds: string[]) {
    const allSelected = visibleIds.every(id => selected.has(id));
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  const claimOpp = claimTargetId ? opps.find((o) => o.id === claimTargetId) ?? null : null;
  const claim = claimTargetId ? claimState[claimTargetId] : null;
  const claimUrl = claim?.token ? `${SITE_URL}/claim-listing/${claim.token}` : null;
  const inviteOpp = inviteTargetId ? opps.find(o => o.id === inviteTargetId) ?? null : null;
  const selectedOpps = opps.filter(o => selected.has(o.id));

  // Filter opps by search + claim status
  const q = search.trim().toLowerCase();
  const filteredOpps = opps.filter(o => {
    if (claimFilter !== "all" && getClaimStatus(o) !== claimFilter) return false;
    if (q && !o.title?.toLowerCase().includes(q) && !o.organiser?.toLowerCase().includes(q)) return false;
    return true;
  });

  const visibleIds = filteredOpps.map(o => o.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  return (
    <>
      {/* Header toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Search title or organiser…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-xs border border-border pl-6 pr-2 py-1.5 focus:outline-none focus:border-black bg-background w-52"
            />
          </div>

          {/* Claim filter */}
          <select
            value={claimFilter}
            onChange={e => setClaimFilter(e.target.value as ClaimFilter)}
            className="text-xs border border-border px-2 py-1.5 focus:outline-none focus:border-black bg-background"
          >
            <option value="all">All claim statuses</option>
            <option value="none">No invite sent</option>
            <option value="scheduled">Scheduled</option>
            <option value="sent">Sent</option>
            <option value="opened">Opened</option>
            <option value="claimed">Claimed</option>
          </select>

          {/* Bulk invite button */}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setBulkPanelOpen(true)}
              className="text-xs bg-black text-white px-3 py-1.5 hover:bg-black/80 transition-colors"
            >
              Send claim invites ({selected.size})
            </button>
          )}
        </div>

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

      {/* Toast */}
      {toast && (
        <div className="mb-3 text-xs bg-black text-white px-4 py-2.5">
          {toast}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-3 pr-3 font-medium text-muted-foreground w-8">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={() => toggleSelectAll(visibleIds)}
                  className="cursor-pointer"
                />
              </th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Title</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Type</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Country</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Deadline</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Status</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Claim status</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Actions</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Claim</th>
              <th className="py-3 font-medium text-muted-foreground">Report</th>
            </tr>
          </thead>
          <tbody>
            {filteredOpps.map((o) => {
              const expired = o.deadline && o.deadline < today;
              const isClaimSelected = claimTargetId === o.id;
              const hasToken = !!(claimState[o.id]?.token);
              const isChecked = selected.has(o.id);

              return (
                <tr
                  key={o.id}
                  className={`border-b border-border transition-colors ${isClaimSelected ? "bg-blue-50/40" : isChecked ? "bg-muted/30" : ""}`}
                >
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelect(o.id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="py-3 pr-4 max-w-[200px]">
                    <span className="line-clamp-1">{o.title}</span>
                    <span className="text-muted-foreground block truncate">{o.organiser}</span>
                    {isSlugBad(o.slug) && (
                      <span className="flex items-center gap-1.5 text-destructive">
                        <span className="truncate">Bad slug: {o.slug ?? "(none)"}</span>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => act(async () => {
                            const result = await regenerateOpportunitySlug(o.id);
                            if (result.error) window.alert(result.error);
                          })}
                          className="underline underline-offset-2 hover:text-foreground shrink-0"
                        >
                          Fix
                        </button>
                      </span>
                    )}
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
                    <ClaimStatusBadge opp={o} />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1.5">
                      <Link
                        href={`/partner/opportunities/${o.id}/manage`}
                        title="Manage listing (settings, applications, etc.)"
                        className="inline-flex items-center justify-center h-7 w-7 border border-border hover:border-black transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </Link>
                      <Button
                        size="sm"
                        variant={o.is_active ? "outline" : "default"}
                        disabled={isPending}
                        onClick={() => act(() => toggleOpportunityActive(o.id, o.is_active))}
                        className="text-xs h-7 px-2"
                      >
                        {o.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <button
                        type="button"
                        title={o.is_featured ? "Remove from featured" : "Feature this opportunity"}
                        disabled={isPending}
                        onClick={() => act(() => toggleOpportunityFeatured(o.id, o.is_featured))}
                        className={`inline-flex items-center justify-center h-7 w-7 border transition-colors disabled:opacity-50 ${
                          o.is_featured
                            ? "border-black bg-black text-white"
                            : "border-border hover:border-black text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" fill={o.is_featured ? "currentColor" : "none"} />
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => setDeleteTarget(o)}
                        className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                      >
                        Delete
                      </Button>
                      <button
                        type="button"
                        title="Send claim invite"
                        onClick={() => setInviteTargetId(o.id)}
                        className="inline-flex items-center justify-center h-7 w-7 border border-border hover:border-black transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => setClaimTargetId(isClaimSelected ? null : o.id)}
                      className={`text-xs px-2 py-1 border transition-colors ${
                        isClaimSelected
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
        {filteredOpps.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {q ? `No opportunities matching "${search}".` : claimFilter !== "all" ? "No opportunities with this claim status." : "No opportunities yet."}
          </p>
        )}
      </div>

      {/* ── Claim link modal ──────────────────────────────────────────────── */}
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
                  <button
                    type="button"
                    onClick={() => {
                      setClaimTargetId(null);
                      setInviteTargetId(claimOpp.id);
                    }}
                    className="w-full text-xs bg-black text-white px-3 py-2 hover:bg-black/80 transition-colors"
                  >
                    Send email invite →
                  </button>
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

      {/* ── Claim invite panel ────────────────────────────────────────────── */}
      {inviteOpp && (
        <ClaimInvitePanel
          opp={inviteOpp}
          onClose={() => setInviteTargetId(null)}
          onSent={(msg) => {
            setInviteTargetId(null);
            showToast(msg);
            router.refresh();
          }}
        />
      )}

      {/* ── Bulk claim panel ──────────────────────────────────────────────── */}
      {bulkPanelOpen && selectedOpps.length > 0 && (
        <BulkClaimPanel
          opps={selectedOpps}
          onClose={() => setBulkPanelOpen(false)}
          onDone={(msg) => {
            setBulkPanelOpen(false);
            setSelected(new Set());
            showToast(msg);
            router.refresh();
          }}
        />
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

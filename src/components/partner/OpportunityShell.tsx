"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Bell, ExternalLink, MoreHorizontal } from "lucide-react";
import { BatchNotificationPanel } from "./BatchNotificationPanel";
import { KanbanView } from "./pipeline/KanbanView";
import { TableView } from "./pipeline/TableView";
import { TriageView } from "./pipeline/TriageView";
import { ApplicantPanel } from "./ApplicantPanel";
import { CollaboratorsPanel } from "./CollaboratorsPanel";
import { closeOpportunity, delistOpportunity, relistOpportunity } from "@/app/partner/dashboard/actions";
import type { EnrichedApp, OpportunityShape } from "./ApplicationsManager";
import type { OpportunityCollaborator, PipelineConfig } from "@/types/database";

const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  shortlisted: "Shortlisted",
  selected: "Selected",
  approved_pending_assets: "Awaiting File",
  production_ready: "Ready",
  rejected: "Rejected",
};

const STATUS_ORDER = ["pending", "shortlisted", "selected", "approved_pending_assets", "production_ready", "rejected"];

const STATUS_DOTS: Record<string, string> = {
  pending: "bg-amber-400",
  shortlisted: "bg-stone-700",
  selected: "bg-emerald-500",
  approved_pending_assets: "bg-blue-400",
  production_ready: "bg-violet-500",
  rejected: "bg-stone-300",
};

type ViewMode = "kanban" | "table" | "triage";
type TabId = "pipeline" | "setup" | "analytics" | "impact" | "collaborators";

interface FollowupRow {
  id: string;
  profile_id: string;
  followup_type: string;
  sent_at: string | null;
  completed_at: string | null;
  further_opportunities: string | null;
  exhibitions: string | null;
  press_coverage: string | null;
  income_from_practice: string | null;
  community_projects: string | null;
  testimonial: string | null;
  testimonial_consent: boolean;
  additional_notes: string | null;
}

type OppExtra = {
  profile_id: string;
  status: string;
  routing_type: string;
  organiser?: string;
  country?: string | null;
  city?: string | null;
  deadline?: string | null;
  opens_at?: string | null;
  funding_range?: string | null;
  featured_image_url?: string | null;
  caption?: string | null;
  full_description?: string | null;
  is_featured?: boolean;
  pipeline_paid_at?: string | null;
  is_active?: boolean;
};

interface Props {
  opp: OpportunityShape & OppExtra;
  apps: EnrichedApp[];
  followups: FollowupRow[];
  collaborators: OpportunityCollaborator[];
  isOwner: boolean;
  opportunityId: string;
}

function exportCSV(apps: EnrichedApp[], opp: OpportunityShape) {
  const questions: { id: string; label: string }[] = opp.pipeline_config?.questions?.length
    ? opp.pipeline_config.questions.map((q: { id: string; label: string }) => ({ id: q.id, label: q.label }))
    : (opp.custom_fields ?? []).map((f: { id: string; question: string }) => ({ id: f.id, label: f.question }));

  const headers = [
    "Name", "Email", "Username", "Career Stage", "Disciplines",
    "City", "Country", "Date", "Status",
    ...questions.map((q) => q.label),
  ];

  const rows = apps.map((app) => {
    const a = app.artist;
    const answers = app.custom_answers ?? {};
    return [
      a?.full_name ?? "",
      a?.email ?? "",
      a?.username ?? "",
      a?.career_stage ?? "",
      (a?.medium ?? []).join("; "),
      a?.city ?? "",
      a?.country ?? "",
      new Date(app.created_at).toLocaleDateString("en-NZ"),
      STATUS_LABELS[app.status] ?? app.status,
      ...questions.map((q: { id: string }) => answers[q.id] ?? ""),
    ];
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(String).map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opp.slug ?? opp.id}-applications-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OpportunityShell({ opp, apps, followups, collaborators, isOwner, opportunityId }: Props) {
  const [tab, setTab] = useState<TabId>("pipeline");
  const [view, setView] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [openAppId, setOpenAppId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [localApps, setLocalApps] = useState(apps);
  const [confirmDialog, setConfirmDialog] = useState<"close_capacity" | "close_round" | "delist" | "relist" | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const openApp = openAppId ? localApps.find((a) => a.id === openAppId) ?? null : null;

  function handleStatusChange(appId: string, status: string) {
    setLocalApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
  }

  const filtered = statusFilter ? localApps.filter((a) => a.status === statusFilter) : localApps;

  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, localApps.filter((a) => a.status === s).length]));
  const isPipeline = opp.routing_type === "pipeline";
  const isDelisted = opp.status === "unlisted";
  const isClosed = opp.is_active === false;

  const daysLeft = opp.deadline
    ? Math.ceil((new Date(opp.deadline + "T00:00:00").getTime() - Date.now()) / 86400000)
    : null;

  const TABS: { id: TabId; label: string }[] = [
    { id: "pipeline", label: `Pipeline${localApps.length > 0 ? ` ${localApps.length}` : ""}` },
    { id: "setup", label: "Setup" },
    { id: "analytics", label: "Analytics" },
    { id: "impact", label: `Impact${followups.length > 0 ? ` ${followups.length}` : ""}` },
    { id: "collaborators", label: `Collaborators${collaborators.length > 0 ? ` ${collaborators.length}` : ""}` },
  ];

  async function handleAction(action: "close_capacity" | "close_round" | "delist" | "relist") {
    setActionPending(true);
    setActionError(null);
    let result: { error?: string };
    if (action === "close_capacity" || action === "close_round") {
      result = await closeOpportunity(opportunityId, action === "close_capacity" ? "capacity" : "round_end");
    } else if (action === "delist") {
      result = await delistOpportunity(opportunityId);
    } else {
      result = await relistOpportunity(opportunityId);
    }
    setActionPending(false);
    if (result.error) {
      setActionError(result.error);
    } else {
      setConfirmDialog(null);
      setShowActionsMenu(false);
    }
  }

  const CONFIRM_COPY: Record<string, { title: string; body: string; cta: string; destructive?: boolean }> = {
    close_capacity: {
      title: "Close applications?",
      body: "Applications will close immediately. Existing submissions are preserved and your pipeline continues normally. Applicants will see the listing as closed.",
      cta: "Close applications",
    },
    close_round: {
      title: "End this round?",
      body: "This ends the open round and closes applications. Your pipeline and all submissions remain accessible. Applicants will see the listing as closed.",
      cta: "End round",
    },
    delist: {
      title: "Delist this opportunity?",
      body: "This removes the listing from the public feed and search. Existing applications are unaffected and the listing can be re-published at any time.",
      cta: "Delist",
    },
    relist: {
      title: "Re-publish this listing?",
      body: "The listing will reappear in public search and the opportunity feed.",
      cta: "Re-publish",
    },
  };

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-6">

          {/* Top bar */}
          <div className="h-11 flex items-center justify-between gap-4">
            <Link href="/partner/dashboard" className="flex items-center gap-1 text-xs text-stone-400 hover:text-foreground transition-colors">
              ‹ Partner Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportCSV(localApps, opp)}
                className="flex items-center gap-1.5 text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
              {opp.slug && (
                <Link
                  href={`/opportunities/${opp.slug ?? opp.id}`}
                  target="_blank"
                  className="flex items-center gap-1.5 text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Public listing
                </Link>
              )}
              {isPipeline && (
                <button
                  type="button"
                  onClick={() => setShowNotifications(true)}
                  className="flex items-center gap-1.5 text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors"
                >
                  <Bell className="w-3 h-3" />
                  Notifications
                </button>
              )}
              {isOwner && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowActionsMenu((v) => !v)}
                    className="flex items-center gap-1 text-xs border border-black/20 px-2.5 py-1.5 hover:border-black transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                  {showActionsMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowActionsMenu(false)} />
                      <div className="absolute right-0 top-8 z-40 bg-background border border-black/20 shadow-md py-1 min-w-[180px]">
                        {!isClosed && (
                          <>
                            <button type="button" onClick={() => { setConfirmDialog("close_capacity"); setShowActionsMenu(false); }}
                              className="w-full text-left text-xs px-4 py-2 hover:bg-stone-50 transition-colors">
                              Close applications
                            </button>
                            <button type="button" onClick={() => { setConfirmDialog("close_round"); setShowActionsMenu(false); }}
                              className="w-full text-left text-xs px-4 py-2 hover:bg-stone-50 transition-colors">
                              End round
                            </button>
                            <div className="border-t border-black/10 my-1" />
                          </>
                        )}
                        {isDelisted ? (
                          <button type="button" onClick={() => { setConfirmDialog("relist"); setShowActionsMenu(false); }}
                            className="w-full text-left text-xs px-4 py-2 hover:bg-stone-50 transition-colors">
                            Re-publish listing
                          </button>
                        ) : (
                          <button type="button" onClick={() => { setConfirmDialog("delist"); setShowActionsMenu(false); }}
                            className="w-full text-left text-xs px-4 py-2 hover:bg-stone-50 transition-colors text-stone-500">
                            Delist
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Title + tags */}
          <div className="pb-2 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {opp.type && <span className="text-[10px] border border-black/20 px-2 py-0.5 text-stone-500">{opp.type}</span>}
              {opp.country && <span className="text-[10px] border border-black/20 px-2 py-0.5 text-stone-500">{opp.country}{opp.city ? `, ${opp.city}` : ""}</span>}
              {collaborators.length > 0 && <span className="text-[10px] border border-black/20 px-2 py-0.5 text-stone-500">Committee · {collaborators.length}</span>}
              {daysLeft !== null && (
                <span className={`text-[10px] border px-2 py-0.5 ${daysLeft < 7 && daysLeft > 0 ? "border-red-300 text-red-600 bg-red-50" : "border-black/20 text-stone-500"}`}>
                  {daysLeft > 0 ? `${daysLeft} days left` : "Closed"}
                </span>
              )}
              {counts.pending > 0 && (
                <button type="button" onClick={() => { setTab("pipeline"); setStatusFilter("pending"); }}
                  className="text-[10px] border border-amber-300 bg-amber-50 text-amber-700 px-2 py-0.5 hover:bg-amber-100 transition-colors">
                  {counts.pending} new to review
                </button>
              )}
              {(counts.production_ready ?? 0) > 0 && (
                <span className="text-[10px] border border-blue-200 bg-blue-50 text-blue-700 px-2 py-0.5">
                  {counts.production_ready} in production
                </span>
              )}
              {isClosed && <span className="text-[10px] border border-stone-300 bg-stone-100 text-stone-600 px-2 py-0.5">Applications closed</span>}
              {isDelisted && <span className="text-[10px] border border-stone-300 bg-stone-100 text-stone-600 px-2 py-0.5">Delisted</span>}
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{opp.title}</h1>
              {(opp.funding_range || opp.organiser) && (
                <p className="text-sm text-stone-500">
                  {[opp.funding_range, opp.organiser].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex items-center -mb-px">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id ? "border-black text-foreground font-medium" : "border-transparent text-stone-400 hover:text-foreground"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">

        {/* ── Pipeline tab ── */}
        {tab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button type="button" onClick={() => setStatusFilter(null)}
                  className={`text-xs px-3 py-1.5 border transition-colors ${statusFilter === null ? "border-black bg-black text-white" : "border-stone-200 hover:border-black"}`}>
                  All ({localApps.length})
                </button>
                {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
                  <button key={s} type="button" onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border transition-colors ${statusFilter === s ? "border-black bg-black text-white" : "border-stone-200 hover:border-black"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusFilter === s ? "bg-white" : STATUS_DOTS[s]}`} />
                    {STATUS_LABELS[s]} ({counts[s]})
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex border border-black/20">
                  {(isPipeline ? (["table", "kanban", "triage"] as ViewMode[]) : (["table"] as ViewMode[])).map((v) => (
                    <button key={v} type="button" onClick={() => setView(v)}
                      className={`px-3 py-1.5 text-xs transition-colors ${view === v ? "bg-black text-white" : "hover:bg-muted"}`}>
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {view === "table" && <TableView apps={filtered} onOpenApp={setOpenAppId} onStatusChange={handleStatusChange} />}
            {view === "kanban" && <KanbanView apps={filtered} onOpenApp={setOpenAppId} onStatusChange={handleStatusChange} />}
            {view === "triage" && <TriageView apps={filtered} onOpenApp={setOpenAppId} onStatusChange={handleStatusChange} />}
          </div>
        )}

        {/* ── Setup tab ── */}
        {tab === "setup" && (
          <SetupTab opp={opp} opportunityId={opportunityId} isOwner={isOwner} />
        )}

        {/* ── Analytics tab ── */}
        {tab === "analytics" && <AnalyticsTab apps={localApps} opp={opp} />}

        {/* ── Impact tab ── */}
        {tab === "impact" && <ImpactTab followups={followups} apps={localApps} />}

        {/* ── Collaborators tab ── */}
        {tab === "collaborators" && (
          <CollaboratorsPanel opportunityId={opportunityId} initialCollaborators={collaborators} isOwner={isOwner} />
        )}
      </div>

      {/* Notification batch panel */}
      {showNotifications && (
        <BatchNotificationPanel opportunityId={opportunityId} onClose={() => setShowNotifications(false)} />
      )}

      {/* Application detail modal */}
      {openApp && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpenAppId(null)}>
          <div className="absolute inset-0 sm:inset-6 lg:inset-8 bg-background shadow-2xl flex flex-col overflow-hidden max-w-6xl mx-auto"
            onClick={(e) => e.stopPropagation()}>
            <ApplicantPanel
              application={{
                ...openApp,
                documentation: (openApp as { documentation?: Record<string, string> | null }).documentation ?? null,
                invoice_requested_at: null,
                invoice_amount: null,
                invoice_paid_at: null,
              }}
              opportunity={opp}
              closeUrl={`/partner/dashboard/${opportunityId}`}
              onClose={() => setOpenAppId(null)}
              allApps={localApps}
              onNavigate={(id) => setOpenAppId(id)}
            />
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmDialog && (() => {
        const copy = CONFIRM_COPY[confirmDialog];
        return (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmDialog(null)}>
            <div className="bg-background w-full max-w-sm p-6 space-y-4 border border-black/10 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="font-semibold">{copy.title}</p>
              <p className="text-sm text-stone-500 leading-relaxed">{copy.body}</p>
              {actionError && <p className="text-xs text-red-500">{actionError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => handleAction(confirmDialog)} disabled={actionPending}
                  className="flex-1 text-sm px-4 py-2 bg-black text-white hover:bg-black/80 transition-colors disabled:opacity-50">
                  {actionPending ? "Saving…" : copy.cta}
                </button>
                <button type="button" onClick={() => setConfirmDialog(null)}
                  className="flex-1 text-sm px-4 py-2 border border-black/20 hover:border-black transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({ opp, opportunityId, isOwner }: { opp: OpportunityShape & OppExtra; opportunityId: string; isOwner: boolean }) {
  const questions = opp.pipeline_config?.questions ?? [];
  const isPipelinePaid = !!opp.pipeline_paid_at;
  const statusLabel = opp.status === "published" ? "Live" : opp.status === "unlisted" ? "Delisted" : opp.status === "draft" ? "Draft" : opp.status;
  const statusColor = opp.status === "published" ? "text-emerald-600" : opp.status === "unlisted" ? "text-stone-500" : "text-amber-600";

  return (
    <div className="max-w-3xl space-y-8">
      {/* Listing summary card */}
      <div className="border border-black/10 overflow-hidden">
        <div className="p-6 grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-6">
          <div className="space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Opportunity</p>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{opp.title}</h2>
              {opp.caption && <p className="text-sm text-stone-500">{opp.caption}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {opp.type && <span className="text-xs border border-black/20 px-2 py-0.5 text-stone-500">{opp.type}</span>}
              {opp.country && <span className="text-xs border border-black/20 px-2 py-0.5 text-stone-500">{opp.country}</span>}
              {(opp.pipeline_config?.questions?.[0] as { category?: string } | undefined)?.category && (
                <span className="text-xs border border-black/20 px-2 py-0.5 text-stone-500">NZ-based</span>
              )}
            </div>
          </div>
          <div className="space-y-3 text-xs">
            {opp.funding_range && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-0.5">Funding</p>
                <p className="font-medium">{opp.funding_range}</p>
              </div>
            )}
            {opp.opens_at && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-0.5">Opens</p>
                <p>{new Date(opp.opens_at + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
            {opp.deadline && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-0.5">Closes</p>
                <p>{new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-0.5">Routing</p>
              <p>{opp.routing_type === "pipeline" ? `Pipeline${isPipelinePaid ? " · paid" : " · free round"}` : "External link"}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-0.5">Featured</p>
              <p>
                {opp.is_featured ? "Yes" : (
                  <span>No · <a href={`/partner/opportunities/${opportunityId}/manage`} className="underline underline-offset-2 hover:text-foreground transition-colors">boost</a></span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-black/10 px-6 py-3 flex items-center justify-between gap-4 bg-stone-50/50">
          <div className="flex gap-2">
            <Link href={`/partner/opportunities/${opportunityId}/manage`}
              className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
              Edit details
            </Link>
            <Link href={`/partner/opportunities/${opportunityId}/manage`}
              className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
              Edit description
            </Link>
            {opp.slug && (
              <Link href={`/opportunities/${opp.slug}`} target="_blank"
                className="flex items-center gap-1 text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
                <ExternalLink className="w-3 h-3" />
                Public listing
              </Link>
            )}
          </div>
          <span className={`text-xs font-medium ${statusColor}`}>
            ● {statusLabel}
          </span>
        </div>
      </div>

      {/* Application questions */}
      {questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Application questions</h3>
              <p className="text-xs text-stone-400 mt-0.5">{questions.length} question{questions.length !== 1 ? "s" : ""} applicants answer when applying</p>
            </div>
            {isOwner && (
              <Link href={`/partner/opportunities/${opportunityId}/manage`}
                className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
                + Add question
              </Link>
            )}
          </div>
          <div className="border border-black/10 divide-y divide-black/5">
            {questions.map((q: { id: string; label: string; type: string; required?: boolean }, i: number) => (
              <div key={q.id} className="flex items-center gap-4 px-4 py-3">
                <span className="text-[11px] font-mono text-stone-300 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <p className="flex-1 text-sm font-medium">{q.label}</p>
                <span className="text-xs text-stone-400 shrink-0 hidden sm:block">{q.type?.replace("_", " ")}</span>
                <span className={`text-xs font-medium shrink-0 ${q.required !== false ? "text-red-500" : "text-stone-400"}`}>
                  {q.required !== false ? "Required" : "Optional"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ apps, opp }: { apps: EnrichedApp[]; opp: OpportunityShape & OppExtra }) {
  const total = apps.length;
  const viewCount = opp.view_count ?? 0;
  const shortlisted = apps.filter((a) => ["shortlisted", "selected", "approved_pending_assets", "production_ready"].includes(a.status)).length;
  const selected = apps.filter((a) => ["selected", "approved_pending_assets", "production_ready"].includes(a.status)).length;
  const selectionRate = total > 0 ? Math.round((selected / total) * 100) : 0;

  // Submissions over time — group by date
  const dateMap = new Map<string, number>();
  for (const app of apps) {
    const d = app.created_at.slice(0, 10);
    dateMap.set(d, (dateMap.get(d) ?? 0) + 1);
  }
  const sortedDates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  const timePoints = sortedDates.map(([date, count]) => {
    cumulative += count;
    return { date, count: cumulative };
  });

  // Demographics
  const byCareer = groupBy(apps, (a) => a.artist?.career_stage ?? "Unknown");
  const byDiscipline = groupByMulti(apps, (a) => a.artist?.medium ?? []);
  const byCity = groupBy(apps, (a) => a.artist?.city ?? "Unknown");
  const byAgeGroup = groupBy(apps, (a) => {
    const yob = a.artist?.year_of_birth;
    if (!yob) return "Unknown";
    const age = new Date().getFullYear() - yob;
    if (age < 25) return "18–24";
    if (age < 35) return "25–34";
    if (age < 45) return "35–44";
    if (age < 55) return "45–54";
    if (age < 65) return "55–64";
    return "65+";
  });
  const identityTags = groupByMulti(apps, (a) => (a.artist as { identity_tags?: string[] } | null)?.identity_tags ?? []);

  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-black/10 border border-black/10">
        {[
          { label: "LISTING VIEWS", value: viewCount.toLocaleString("en-NZ"), sub: viewCount > 0 ? "from opportunity page" : "no data" },
          { label: "APPLICATION STARTS", value: "—", sub: "not tracked" },
          { label: "SUBMITTED", value: total.toLocaleString("en-NZ"), sub: `${selectionRate}% selection rate` },
          { label: "SELECTION RATE", value: `${selectionRate}%`, sub: `${selected} of ${total}` },
        ].map((k) => (
          <div key={k.label} className="bg-background p-5 space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">{k.label}</p>
            <p className="text-3xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-stone-400">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Conversion funnel */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Conversion funnel</h3>
          <p className="text-xs text-stone-400 mt-0.5">From listing view through to selection</p>
        </div>
        <div className="border border-black/10 overflow-hidden">
          {[
            { label: "Listing views", count: viewCount, color: "bg-stone-700" },
            { label: "Submitted", count: total, color: "bg-stone-600" },
            { label: "Shortlisted", count: shortlisted, color: "bg-stone-800" },
            { label: "Selected", count: selected, color: "bg-emerald-600" },
          ].map((row, i, arr) => {
            const base = arr[0].count || 1;
            const pct = Math.round((row.count / base) * 100);
            const drop = i > 0 ? arr[i - 1].count - row.count : null;
            return (
              <div key={row.label} className="flex items-center gap-4 px-5 py-3 border-b border-black/5 last:border-0">
                <span className="text-sm text-stone-500 w-32 shrink-0">{row.label}</span>
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 h-8 bg-stone-50 relative">
                    <div className={`h-full ${row.color} flex items-center justify-end pr-3`} style={{ width: `${Math.max(pct, row.count > 0 ? 2 : 0)}%` }}>
                      {row.count > 0 && <span className="text-xs font-medium text-white">{row.count.toLocaleString("en-NZ")}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-stone-400 w-10 text-right shrink-0">{pct}%</span>
                  {drop !== null && drop > 0 && (
                    <span className="text-xs text-stone-300 w-20 shrink-0">−{drop.toLocaleString("en-NZ")} drop</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submissions over time */}
      {timePoints.length > 1 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Submissions over time</h3>
            <p className="text-xs text-stone-400 mt-0.5">Cumulative applications across the open window</p>
          </div>
          <div className="border border-black/10 p-5">
            <MiniLineChart points={timePoints} />
          </div>
        </div>
      )}

      {/* Demographics */}
      {total > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">Applicant demographics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DemoBarChart title="Career stage" rows={byCareer} total={total} />
            <DemoBarChart title="Discipline" rows={byDiscipline.slice(0, 10)} total={total} />
            <DemoBarChart title="Location" rows={byCity.slice(0, 8)} total={total} />
            <DemoBarChart title="Age band" rows={byAgeGroup} total={total} sortOrder={["18–24", "25–34", "35–44", "45–54", "55–64", "65+", "Unknown"]} />
          </div>
        </div>
      )}

      {/* Identity tags */}
      {identityTags.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">Identity tags</h3>
            <p className="text-xs text-stone-400 mt-0.5">Optional self-identification</p>
          </div>
          <div className="border border-black/10 divide-y divide-black/5">
            {identityTags.map((r) => {
              const pct = total > 0 ? (r.count / total) * 100 : 0;
              return (
                <div key={r.label} className="px-5 py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="text-stone-400 tabular-nums">{r.count} <span className="text-stone-300">({Math.round(pct)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-stone-100">
                    <div className="h-full bg-black" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {total === 0 && <p className="text-sm text-stone-400">No applications yet.</p>}
    </div>
  );
}

function MiniLineChart({ points }: { points: { date: string; count: number }[] }) {
  const maxCount = Math.max(...points.map((p) => p.count));
  const W = 600;
  const H = 120;
  const PAD = { t: 10, r: 10, b: 30, l: 30 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const x = (i: number) => PAD.l + (i / (points.length - 1)) * iW;
  const y = (v: number) => PAD.t + iH - (v / maxCount) * iH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${(PAD.t + iH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + iH).toFixed(1)} Z`;

  // X-axis: show ~5 labels
  const step = Math.max(1, Math.floor(points.length / 5));
  const xLabels = points.filter((_, i) => i % step === 0 || i === points.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y grid lines */}
      {[0, 0.5, 1].map((pct) => (
        <line key={pct} x1={PAD.l} y1={PAD.t + iH * (1 - pct)} x2={W - PAD.r} y2={PAD.t + iH * (1 - pct)}
          stroke="#e7e5e4" strokeWidth="1" />
      ))}
      {/* Y labels */}
      {[0, maxCount].map((v) => (
        <text key={v} x={PAD.l - 4} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#a8a29e">{v}</text>
      ))}
      {/* Area */}
      <path d={area} fill="url(#area-fill)" />
      {/* Line */}
      <path d={path} fill="none" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
      {/* X labels */}
      {xLabels.map((p) => {
        const i = points.indexOf(p);
        const d = new Date(p.date + "T00:00:00");
        const label = d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
        return (
          <text key={p.date} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#a8a29e">{label}</text>
        );
      })}
    </svg>
  );
}

function DemoBarChart({
  title, rows, total, sortOrder,
}: {
  title: string;
  rows: { label: string; count: number }[];
  total: number;
  sortOrder?: string[];
}) {
  const sorted = sortOrder
    ? [...rows].sort((a, b) => (sortOrder.indexOf(a.label) ?? 999) - (sortOrder.indexOf(b.label) ?? 999))
    : rows;

  return (
    <div className="border border-black/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs text-stone-400">n = {total}</span>
      </div>
      <div className="space-y-2">
        {sorted.map((r) => {
          const pct = total > 0 ? (r.count / total) * 100 : 0;
          return (
            <div key={r.label} className="space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-700 w-32 shrink-0 truncate">{r.label}</span>
                <div className="flex-1 h-4 bg-stone-100 relative">
                  <div className="h-full bg-black" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-stone-400 w-5 text-right tabular-nums shrink-0">{r.count}</span>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <p className="text-xs text-stone-400">No data</p>}
      </div>
    </div>
  );
}

function groupBy(apps: EnrichedApp[], key: (a: EnrichedApp) => string) {
  const map = new Map<string, number>();
  for (const app of apps) {
    const k = key(app);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function groupByMulti(apps: EnrichedApp[], key: (a: EnrichedApp) => string[]) {
  const map = new Map<string, number>();
  for (const app of apps) {
    for (const k of key(app)) {
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// ── Impact tab ───────────────────────────────────────────────────────────────

function ImpactTab({ followups, apps }: { followups: FollowupRow[]; apps: EnrichedApp[] }) {
  const responded = followups.filter((f) => f.completed_at);
  const selectedApps = apps.filter((a) => ["selected", "approved_pending_assets", "production_ready"].includes(a.status));
  const profileMap = new Map(apps.map((a) => [a.artist?.id ?? "", a.artist]));

  // Parse income as number if possible
  function parseIncome(text: string | null): number {
    if (!text) return 0;
    const num = parseFloat(text.replace(/[^0-9.]/g, ""));
    return isNaN(num) ? 0 : num;
  }

  const totalIncome = responded.reduce((sum, f) => sum + parseIncome(f.income_from_practice), 0);
  const totalExhibitions = responded.filter((f) => f.exhibitions).length;
  const totalPress = responded.filter((f) => f.press_coverage).length;
  const totalCommunity = responded.filter((f) => f.community_projects).length;

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Cumulative impact header */}
      {responded.length > 0 && (
        <div className="border border-black/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-black/10 bg-stone-50/50">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Cumulative impact</p>
            <p className="text-sm font-semibold mt-0.5">Across {responded.length} past recipient{responded.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-black/10">
            {[
              { label: "Further exhibitions", value: totalExhibitions },
              { label: "Press mentions", value: totalPress },
              { label: "Community projects", value: totalCommunity },
              { label: "Income from practice", value: totalIncome > 0 ? `$${(totalIncome / 1000).toFixed(0)}k` : "—" },
            ].map((m) => (
              <div key={m.label} className="p-5 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">{m.label}</p>
                <p className="text-2xl font-semibold">{m.value}</p>
                {m.label === "Income from practice" && totalIncome > 0 && (
                  <p className="text-xs text-stone-400">reported, this cohort</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-recipient cards */}
      {selectedApps.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Recipients</p>
          <div className="space-y-4">
            {selectedApps.map((app) => {
              const artist = app.artist;
              if (!artist) return null;
              const followup = responded.find((f) => f.profile_id === artist.id);
              const initials = (artist.full_name ?? artist.username)
                .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
              const income = parseIncome(followup?.income_from_practice ?? null);
              return (
                <div key={app.id} className="border border-black/10">
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-700 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{artist.full_name ?? artist.username}</p>
                          <span className="text-[10px] border border-black/20 px-1.5 py-0.5 text-stone-400">recipient</span>
                          <span className="text-[10px] text-stone-400">{new Date(app.created_at).getFullYear()}</span>
                        </div>
                        {followup?.further_opportunities && (
                          <p className="text-xs text-stone-500 mt-0.5">{followup.further_opportunities}</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/${artist.username}`} target="_blank"
                      className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors flex items-center gap-1 shrink-0">
                      <ExternalLink className="w-3 h-3" />
                      View profile
                    </Link>
                  </div>

                  {followup && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-black/10 border-t border-black/10">
                        {[
                          { label: "Exhibitions", value: followup.exhibitions || "—" },
                          { label: "Press", value: followup.press_coverage || "—" },
                          { label: "Community projects", value: followup.community_projects || "—" },
                          { label: "Income from practice", value: income > 0 ? `$${income.toLocaleString("en-NZ")}` : (followup.income_from_practice || "—") },
                        ].map((m) => (
                          <div key={m.label} className="px-4 py-3">
                            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">{m.label}</p>
                            <p className="text-base font-semibold mt-0.5">{m.value}</p>
                          </div>
                        ))}
                      </div>
                      {followup.testimonial && followup.testimonial_consent && (
                        <div className="border-t border-black/10 px-5 py-4 bg-stone-50/50">
                          <blockquote className="text-sm italic text-stone-700 leading-relaxed">
                            &ldquo;{followup.testimonial}&rdquo;
                          </blockquote>
                          <p className="text-[11px] text-stone-400 mt-2 flex items-center gap-1">
                            <span>✓</span> Consent given to share publicly
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {!followup && (
                    <div className="border-t border-black/10 px-5 py-3">
                      <p className="text-xs text-stone-400">No follow-up response yet.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedApps.length === 0 && (
        <p className="text-sm text-stone-400">No selected recipients yet. Impact data is collected automatically from artists after the programme completes.</p>
      )}

      {void profileMap}
    </div>
  );
}

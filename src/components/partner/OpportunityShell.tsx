"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { ResultsTab } from "./ResultsTab";
import { KanbanView } from "./pipeline/KanbanView";
import { TableView } from "./pipeline/TableView";
import { TriageView } from "./pipeline/TriageView";
import { ApplicantPanel } from "./ApplicantPanel";
import { CollaboratorsPanel } from "./CollaboratorsPanel";
import { NextStepBanner } from "./NextStepBanner";
import { AccessibleDialog } from "@/components/ui/AccessibleDialog";
import {
  closeOpportunity,
  delistOpportunity,
  relistOpportunity,
  reopenOpportunity,
  archiveOpportunity,
  unarchiveOpportunity,
  getApplicantEmails,
} from "@/app/partner/dashboard/actions";
import { getReviewOverview, type ReviewOverview } from "@/app/partner/dashboard/review-actions";
import type { EnrichedApp, OpportunityShape } from "./types";
import type { OpportunityCollaborator } from "@/types/database";
import { getStagesWithOccupied, stageLabel } from "@/lib/pipeline-stages";
import { nextStep, type NextTarget } from "@/lib/next-step";

type ViewMode = "kanban" | "table" | "triage";
type TabId = "applications" | "results" | "settings";
type SettingsTabId = "listing" | "team" | "reports" | "impact";

const VIEW_LABEL: Record<ViewMode, string> = { table: "List", kanban: "Board", triage: "One by one" };

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
  archived_at?: string | null;
};

interface Props {
  opp: OpportunityShape & OppExtra;
  apps: EnrichedApp[];
  followups: FollowupRow[];
  collaborators: OpportunityCollaborator[];
  isOwner: boolean;
  /** Owner, admin or editor collaborator. Viewers can read but not decide or export. */
  canEdit: boolean;
  opportunityId: string;
  initialTab?: TabId;
}

type LifecycleAction = "close" | "delist" | "relist" | "reopen" | "archive" | "unarchive";

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
      stageLabel(app.status, opp.pipeline_config?.pipeline_stages ?? null),
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

const CONFIRM_COPY: Record<LifecycleAction, { title: string; body: string; cta: string }> = {
  reopen: {
    title: "Reopen applications?",
    body: "Artists will be able to apply again until the deadline.",
    cta: "Reopen applications",
  },
  archive: {
    title: "Archive this call?",
    body: "Use this when you are completely finished. Applications close and the call moves out of your live list. The public page and every application are kept, and you can restore it any time.",
    cta: "Archive this call",
  },
  unarchive: {
    title: "Restore from archive?",
    body: "The call returns to your list. Applications stay closed until you reopen them.",
    cta: "Restore",
  },
  close: {
    title: "Close applications?",
    body: "Artists will no longer be able to apply, and the listing will show as closed. Everything you have received is kept, and you can carry on reviewing.",
    cta: "Close applications",
  },
  delist: {
    title: "Hide this call from the public?",
    body: "It is taken off the Patronage listings and search. Applications you have received are not affected, and you can show it again whenever you like.",
    cta: "Hide from public",
  },
  relist: {
    title: "Show this call to the public again?",
    body: "It will reappear in the listings and search.",
    cta: "Show to the public",
  },
};

export function OpportunityShell({ opp, apps, followups, collaborators, isOwner, canEdit, opportunityId, initialTab = "applications" }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab === "results" && !(opp.routing_type === "pipeline" && isOwner) ? "applications" : initialTab);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("listing");
  const [view, setView] = useState<ViewMode>("table");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [openAppId, setOpenAppId] = useState<string | null>(null);
  const [localApps, setLocalApps] = useState(apps);
  const [overview, setOverview] = useState<ReviewOverview | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<LifecycleAction | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const openApp = openAppId ? localApps.find((a) => a.id === openAppId) ?? null : null;

  function say(text: string) {
    clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  function handleStatusChange(appId: string, status: string) {
    setLocalApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
  }

  // Applicant emails are only loaded for people who may see them, and only after
  // the page is up, rather than as one auth lookup per applicant on every render.
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    getApplicantEmails(opportunityId).then((emails) => {
      if (cancelled) return;
      setLocalApps((prev) =>
        prev.map((a) => (a.artist && emails[a.id] ? { ...a, artist: { ...a.artist, email: emails[a.id] } } : a))
      );
    });
    return () => { cancelled = true; };
  }, [canEdit, opportunityId]);

  // Scores, progress and assignments for the board.
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    getReviewOverview(opportunityId).then((ov) => { if (!cancelled && ov) setOverview(ov); });
    return () => { cancelled = true; };
  }, [canEdit, opportunityId]);

  const filtered = statusFilter ? localApps.filter((a) => a.status === statusFilter) : localApps;

  const stages = getStagesWithOccupied(opp.pipeline_config?.pipeline_stages ?? null, localApps);
  const counts = Object.fromEntries(stages.map((s) => [s.val, localApps.filter((a) => a.status === s.val).length]));
  const isPipeline = opp.routing_type === "pipeline";
  const isDelisted = opp.status === "unlisted";
  const isArchived = !!opp.archived_at;
  const isClosedByHand = opp.is_active === false && !isArchived;
  const canReopen = isClosedByHand && opp.status === "published";

  const daysLeft = opp.deadline
    ? Math.ceil((new Date(opp.deadline + "T00:00:00").getTime() - Date.now()) / 86400000)
    : null;
  const isClosed = isClosedByHand || (daysLeft !== null && daysLeft <= 0);

  // Decisions made on the board that artists have not been told about yet.
  const unpublished = localApps.filter((a) => a.status !== "pending" && (a.released_status ?? null) !== a.status).length;
  const reviewerCount = collaborators.filter((c) => c.role === "editor").length;

  const next = nextStep({
    status: opp.status,
    archived: isArchived,
    closed: isClosed,
    daysLeft,
    total: localApps.length,
    undecided: counts.pending ?? 0,
    unpublished,
    reviewers: reviewerCount,
  });

  function goTo(target: NextTarget) {
    switch (target) {
      case "review":
        setTab("applications");
        setStatusFilter("pending");
        setView("triage");
        break;
      case "results":
        setTab("results");
        break;
      case "team":
        setTab("settings");
        setSettingsTab("team");
        break;
      case "close":
        setConfirmDialog("close");
        break;
      case "reopen":
        setConfirmDialog("reopen");
        break;
      case "archive":
        setConfirmDialog("archive");
        break;
      case "edit":
        router.push(`/partner/opportunities/${opportunityId}/new?step=2&type=pipeline`);
        break;
      case "share": {
        const url = `${window.location.origin}/opportunities/${opp.slug ?? opportunityId}`;
        navigator.clipboard?.writeText(url).then(
          () => say("Link copied. Paste it into an email or a post."),
          () => say(`Your link: ${url}`),
        );
        break;
      }
    }
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: "applications", label: `Applications${localApps.length > 0 ? ` (${localApps.length})` : ""}` },
    ...(isPipeline && isOwner ? [{ id: "results" as TabId, label: `Send results${unpublished > 0 ? ` (${unpublished} to send)` : ""}` }] : []),
    { id: "settings", label: "Settings" },
  ];
  const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
    { id: "listing", label: "This call" },
    { id: "team", label: `Review team${collaborators.length > 0 ? ` (${collaborators.length})` : ""}` },
    { id: "reports", label: "Reports" },
    { id: "impact", label: `After the programme${followups.length > 0 ? ` (${followups.length})` : ""}` },
  ];

  function onTabKey<T extends string>(e: React.KeyboardEvent, ids: T[], current: T, set: (id: T) => void) {
    const i = ids.indexOf(current);
    let to: number | null = null;
    if (e.key === "ArrowRight") to = (i + 1) % ids.length;
    else if (e.key === "ArrowLeft") to = (i - 1 + ids.length) % ids.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = ids.length - 1;
    if (to === null) return;
    e.preventDefault();
    set(ids[to]);
    requestAnimationFrame(() => document.getElementById(`tab-${ids[to!]}`)?.focus());
  }

  async function handleAction(action: LifecycleAction) {
    setActionPending(true);
    setActionError(null);
    let result: { error?: string };
    if (action === "close") result = await closeOpportunity(opportunityId, "capacity");
    else if (action === "delist") result = await delistOpportunity(opportunityId);
    else if (action === "relist") result = await relistOpportunity(opportunityId);
    else if (action === "reopen") result = await reopenOpportunity(opportunityId);
    else if (action === "archive") result = await archiveOpportunity(opportunityId);
    else result = await unarchiveOpportunity(opportunityId);
    setActionPending(false);
    if (result.error) {
      setActionError(result.error);
    } else {
      setConfirmDialog(null);
      router.refresh();
    }
  }

  const statusPill = isArchived
    ? { text: "Archived", tone: "bg-stone-100 text-stone-700 border-stone-300" }
    : isDelisted
      ? { text: "Hidden from the public", tone: "bg-stone-100 text-stone-700 border-stone-300" }
      : opp.status !== "published"
        ? { text: opp.status === "draft" ? "Not finished" : "Being checked", tone: "bg-amber-50 text-amber-800 border-amber-300" }
        : isClosed
          ? { text: "Applications closed", tone: "bg-stone-100 text-stone-700 border-stone-300" }
          : { text: daysLeft !== null ? `Open · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : "Open", tone: daysLeft !== null && daysLeft < 7 ? "bg-red-50 text-red-700 border-red-300" : "bg-emerald-50 text-emerald-800 border-emerald-300" };

  const headerBtn = "inline-flex items-center gap-2 border border-black/40 px-4 py-2 font-mono text-sm font-medium hover:border-black transition-colors";

  return (
    <div className="ams-comfort">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-black/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">

          {/* Top bar */}
          <div className="py-2 flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-foreground">
              ‹ Your dashboard
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && isPipeline && (
                <Link href={`/review/${opportunityId}`} className={headerBtn}>
                  Score applications
                </Link>
              )}
              {canEdit && (
                <button type="button" onClick={() => exportCSV(localApps, opp)} className={headerBtn}>
                  <Download className="w-4 h-4" aria-hidden />
                  Download list
                </button>
              )}
              {opp.slug && (
                <Link href={`/opportunities/${opp.slug ?? opp.id}`} target="_blank" className={headerBtn}>
                  <ExternalLink className="w-4 h-4" aria-hidden />
                  See the public page
                </Link>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="pb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-mono text-sm font-medium border px-3 py-1 ${statusPill.tone}`}>{statusPill.text}</span>
              {opp.type && <span className="font-mono text-sm border border-black/20 px-3 py-1 text-stone-600">{opp.type}</span>}
              {opp.country && <span className="font-mono text-sm border border-black/20 px-3 py-1 text-stone-600">{opp.country}{opp.city ? `, ${opp.city}` : ""}</span>}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{opp.title}</h1>
              {(opp.funding_range || opp.organiser) && (
                <p className="text-base text-stone-600">
                  {[opp.funding_range, opp.organiser].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div role="tablist" aria-label="Sections" className="flex items-center -mb-px overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                type="button"
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, TABS.map((x) => x.id), tab, setTab)}
                className={`text-base px-5 py-3 border-b-4 transition-colors whitespace-nowrap ${
                  tab === t.id ? "border-brand text-foreground font-semibold" : "border-transparent text-stone-600 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {notice && (
          <p role="status" className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-base text-emerald-900">{notice}</p>
        )}

        {isPipeline && tab !== "settings" && (
          <NextStepBanner step={next} onAction={goTo} canAct={canEdit && (isOwner || next.action?.target === "review")} />
        )}

        {/* ── Applications tab ── */}
        {tab === "applications" && (
          <div id="panel-applications" role="tabpanel" aria-labelledby="tab-applications" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Show applications">
                <button type="button" onClick={() => setStatusFilter(null)} aria-pressed={statusFilter === null}
                  className={`text-sm px-4 py-2 border transition-colors ${statusFilter === null ? "border-black bg-black text-white" : "border-stone-300 hover:border-black"}`}>
                  Everyone ({localApps.length})
                </button>
                {stages.filter((s) => counts[s.val] > 0).map((s) => (
                  <button key={s.val} type="button" onClick={() => setStatusFilter(statusFilter === s.val ? null : s.val)} aria-pressed={statusFilter === s.val}
                    className={`flex items-center gap-2 text-sm px-4 py-2 border transition-colors ${statusFilter === s.val ? "border-black bg-black text-white" : "border-stone-300 hover:border-black"} ${s.disabled ? "opacity-70" : ""}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusFilter === s.val ? "bg-white" : s.dot}`} aria-hidden />
                    {s.label} ({counts[s.val]})
                  </button>
                ))}
              </div>
              {isPipeline && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-600">View as</span>
                  <div className="flex border border-black/30" role="group" aria-label="View as">
                    {(["table", "kanban", "triage"] as ViewMode[]).map((v) => (
                      <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                        className={`px-4 py-2 text-sm transition-colors ${view === v ? "bg-black text-white" : "hover:bg-muted"}`}>
                        {VIEW_LABEL[v]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {view === "table" && localApps.length > 0 && (
              <p className="text-sm text-stone-600">Select a name to read the whole application. Nothing you choose here is sent to artists until you press &ldquo;Send results&rdquo;.</p>
            )}
            {view === "table" && <TableView apps={filtered} stages={stages} onOpenApp={setOpenAppId} onStatusChange={handleStatusChange} canEdit={canEdit} scores={overview?.hasRubric ? overview.scores : undefined} />}
            {view === "kanban" && <KanbanView apps={filtered} stages={stages} onOpenApp={setOpenAppId} onStatusChange={handleStatusChange} canEdit={canEdit} />}
            {view === "triage" && <TriageView apps={filtered} stages={stages} onOpenApp={setOpenAppId} onStatusChange={handleStatusChange} canEdit={canEdit} paused={openAppId !== null} />}
          </div>
        )}

        {/* ── Results tab ── */}
        {tab === "results" && isPipeline && isOwner && (
          <div id="panel-results" role="tabpanel" aria-labelledby="tab-results">
            <ResultsTab
              opportunityId={opportunityId}
              onPublished={() => {
                // What artists can see has changed: mark everything decided as released.
                setLocalApps((prev) => prev.map((a) => (a.status !== "pending" ? { ...a, released_status: a.status } : a)));
                router.refresh();
              }}
            />
          </div>
        )}

        {/* ── Settings tab ── */}
        {tab === "settings" && (
          <div id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" className="space-y-6">
            <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2">
              {SETTINGS_TABS.map((t) => (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  role="tab"
                  aria-selected={settingsTab === t.id}
                  tabIndex={settingsTab === t.id ? 0 : -1}
                  type="button"
                  onClick={() => setSettingsTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, SETTINGS_TABS.map((x) => x.id), settingsTab, setSettingsTab)}
                  className={`text-base px-4 py-2 border transition-colors ${settingsTab === t.id ? "border-black bg-black text-white" : "border-stone-300 hover:border-black"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {settingsTab === "listing" && (
              <div className="space-y-8">
                {isOwner && (
                  <CallStatusPanel
                    isArchived={isArchived}
                    isClosed={isClosed}
                    canReopen={canReopen}
                    isDelisted={isDelisted}
                    isPublished={opp.status === "published"}
                    onAction={setConfirmDialog}
                    onShare={() => goTo("share")}
                  />
                )}
                <SetupTab opp={opp} opportunityId={opportunityId} isOwner={isOwner} />
              </div>
            )}
            {settingsTab === "team" && (
              <CollaboratorsPanel opportunityId={opportunityId} initialCollaborators={collaborators} isOwner={isOwner} />
            )}
            {settingsTab === "reports" && <AnalyticsTab apps={localApps} opp={opp} />}
            {settingsTab === "impact" && <ImpactTab followups={followups} apps={localApps} />}
          </div>
        )}
      </div>

      {/* Application detail modal */}
      {openApp && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpenAppId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Application from ${openApp.artist?.full_name ?? openApp.artist?.username ?? "applicant"}`}
            className="absolute inset-0 sm:inset-6 lg:inset-8 bg-background shadow-2xl flex flex-col overflow-hidden max-w-6xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <ApplicantPanel
              key={openApp.id}
              canEdit={canEdit}
              isOwner={isOwner}
              overview={overview}
              onStatusChange={handleStatusChange}
              application={{
                ...openApp,
                documentation: openApp.documentation ?? null,
                invoice_requested_at: openApp.invoice_requested_at ?? null,
                invoice_amount: openApp.invoice_amount ?? null,
                invoice_paid_at: openApp.invoice_paid_at ?? null,
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
      <AccessibleDialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} labelledBy="lifecycle-title" className="bg-background w-full max-w-md p-6 space-y-4 border border-black/10 shadow-xl">
        {confirmDialog && (
          <>
            <h2 id="lifecycle-title" className="text-lg font-semibold">{CONFIRM_COPY[confirmDialog].title}</h2>
            <p className="text-base text-stone-600 leading-relaxed">{CONFIRM_COPY[confirmDialog].body}</p>
            {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => handleAction(confirmDialog)} disabled={actionPending}
                className="flex-1 text-base px-4 py-2 bg-brand text-brand-foreground font-medium hover:bg-brand/90 transition-colors disabled:opacity-50">
                {actionPending ? "Saving…" : CONFIRM_COPY[confirmDialog].cta}
              </button>
              <button type="button" onClick={() => setConfirmDialog(null)}
                className="flex-1 text-base px-4 py-2 border border-black/30 hover:border-black transition-colors">
                Go back
              </button>
            </div>
          </>
        )}
      </AccessibleDialog>
    </div>
  );
}

// ── Call status ─────────────────────────────────────────────────────────────

function CallStatusPanel({
  isArchived, isClosed, canReopen, isDelisted, isPublished, onAction, onShare,
}: {
  isArchived: boolean;
  isClosed: boolean;
  canReopen: boolean;
  isDelisted: boolean;
  isPublished: boolean;
  onAction: (a: LifecycleAction) => void;
  onShare: () => void;
}) {
  const rows: { title: string; body: string; label: string; onClick: () => void; show: boolean }[] = [
    { title: "Share this call", body: "Copy the public link to put in an email, newsletter or social post.", label: "Copy the link", onClick: onShare, show: isPublished && !isArchived },
    { title: "Stop taking applications", body: "Artists can no longer apply. Everything received is kept and you carry on reviewing.", label: "Close applications", onClick: () => onAction("close"), show: isPublished && !isClosed && !isArchived },
    { title: "Take applications again", body: "Open the call back up until its deadline.", label: "Reopen applications", onClick: () => onAction("reopen"), show: canReopen },
    { title: "Hide from the public", body: "Take the call off the Patronage listings and search. Applications are kept.", label: "Hide from public", onClick: () => onAction("delist"), show: isPublished && !isDelisted && !isArchived },
    { title: "Show to the public again", body: "Put the call back on the listings and search.", label: "Show to the public", onClick: () => onAction("relist"), show: isDelisted && !isArchived },
    { title: "Finished with this call", body: "Move it out of your live list. The public page and every application are kept.", label: "Archive this call", onClick: () => onAction("archive"), show: !isArchived },
    { title: "Bring it back", body: "Return this call to your list.", label: "Restore from archive", onClick: () => onAction("unarchive"), show: isArchived },
  ];
  return (
    <section className="max-w-3xl space-y-3" aria-label="Open, close and archive">
      <h2 className="text-lg font-semibold">Open, close and archive</h2>
      <ul className="border border-black/10 divide-y divide-black/10">
        {rows.filter((r) => r.show).map((r) => (
          <li key={r.label} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 max-w-md">
              <p className="text-base font-medium">{r.title}</p>
              <p className="text-sm text-stone-600">{r.body}</p>
            </div>
            <button type="button" onClick={r.onClick} className="border border-black px-5 py-2 text-base font-medium hover:bg-stone-100 transition-colors">
              {r.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── This call ─────────────────────────────────────────────────────────────── ────────────────────────────────────────────────────────────────

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
            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">Opportunity</p>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{opp.title}</h2>
              {opp.caption && <p className="text-sm text-stone-500">{opp.caption}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {opp.type && <span className="text-sm border border-black/20 px-2 py-0.5 text-stone-500">{opp.type}</span>}
              {opp.country && <span className="text-sm border border-black/20 px-2 py-0.5 text-stone-500">{opp.country}</span>}
              {(opp.pipeline_config?.questions?.[0] as { category?: string } | undefined)?.category && (
                <span className="text-sm border border-black/20 px-2 py-0.5 text-stone-500">NZ-based</span>
              )}
            </div>
          </div>
          <div className="space-y-3 text-sm">
            {opp.funding_range && (
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-stone-500 mb-0.5">Funding</p>
                <p className="font-medium">{opp.funding_range}</p>
              </div>
            )}
            {opp.opens_at && (
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-stone-500 mb-0.5">Opens</p>
                <p>{new Date(opp.opens_at + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
            {opp.deadline && (
              <div>
                <p className="text-sm font-medium uppercase tracking-widest text-stone-500 mb-0.5">Closes</p>
                <p>{new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-stone-500 mb-0.5">Type of call</p>
              <p>{opp.routing_type === "pipeline" ? `Applications through Patronage${isPipelinePaid ? " · paid" : " · first call"}` : "Applications on another site"}</p>
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-widest text-stone-500 mb-0.5">Featured</p>
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
              className="text-sm border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
              Edit details
            </Link>
            <Link href={`/partner/opportunities/${opportunityId}/manage`}
              className="text-sm border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
              Edit description
            </Link>
            {opp.slug && (
              <Link href={`/opportunities/${opp.slug}`} target="_blank"
                className="flex items-center gap-1 text-sm border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
                <ExternalLink className="w-3 h-3" />
                Public listing
              </Link>
            )}
          </div>
          <span className={`text-sm font-medium ${statusColor}`}>
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
              <p className="text-sm text-stone-500 mt-0.5">{questions.length} question{questions.length !== 1 ? "s" : ""} applicants answer when applying</p>
            </div>
            {isOwner && (
              <Link href={`/partner/opportunities/${opportunityId}/manage`}
                className="text-sm border border-black/20 px-3 py-1.5 hover:border-black transition-colors">
                + Add question
              </Link>
            )}
          </div>
          <div className="border border-black/10 divide-y divide-black/5">
            {questions.map((q: { id: string; label: string; type: string; required?: boolean }, i: number) => (
              <div key={q.id} className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm font-mono text-stone-400 w-6 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <p className="flex-1 text-sm font-medium">{q.label}</p>
                <span className="text-sm text-stone-500 shrink-0 hidden sm:block">{q.type?.replace("_", " ")}</span>
                <span className={`text-sm font-medium shrink-0 ${q.required !== false ? "text-red-500" : "text-stone-500"}`}>
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
            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">{k.label}</p>
            <p className="text-3xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-sm text-stone-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Conversion funnel */}
      <div className="space-y-3">
        <div>
          <h3 className="font-semibold">Conversion funnel</h3>
          <p className="text-sm text-stone-500 mt-0.5">From listing view through to selection</p>
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
                      {row.count > 0 && <span className="text-sm font-medium text-white">{row.count.toLocaleString("en-NZ")}</span>}
                    </div>
                  </div>
                  <span className="text-sm text-stone-500 w-10 text-right shrink-0">{pct}%</span>
                  {drop !== null && drop > 0 && (
                    <span className="text-sm text-stone-400 w-20 shrink-0">−{drop.toLocaleString("en-NZ")} drop</span>
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
            <p className="text-sm text-stone-500 mt-0.5">Cumulative applications across the open window</p>
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
            <p className="text-sm text-stone-500 mt-0.5">Optional self-identification</p>
          </div>
          <div className="border border-black/10 divide-y divide-black/5">
            {identityTags.map((r) => {
              const pct = total > 0 ? (r.count / total) * 100 : 0;
              return (
                <div key={r.label} className="px-5 py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="text-stone-500 tabular-nums">{r.count} <span className="text-stone-400">({Math.round(pct)}%)</span></span>
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

      {total === 0 && <p className="text-sm text-stone-500">No applications yet.</p>}
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
        <span className="text-sm text-stone-500">n = {total}</span>
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
                <span className="text-sm text-stone-500 w-5 text-right tabular-nums shrink-0">{r.count}</span>
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <p className="text-sm text-stone-500">No data</p>}
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
            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">Cumulative impact</p>
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
                <p className="text-sm font-medium uppercase tracking-widest text-stone-500">{m.label}</p>
                <p className="text-2xl font-semibold">{m.value}</p>
                {m.label === "Income from practice" && totalIncome > 0 && (
                  <p className="text-sm text-stone-500">reported, this cohort</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-recipient cards */}
      {selectedApps.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-widest text-stone-500">Recipients</p>
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
                          <span className="text-sm border border-black/20 px-1.5 py-0.5 text-stone-500">recipient</span>
                          <span className="text-sm text-stone-500">{new Date(app.created_at).getFullYear()}</span>
                        </div>
                        {followup?.further_opportunities && (
                          <p className="text-sm text-stone-500 mt-0.5">{followup.further_opportunities}</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/${artist.username}`} target="_blank"
                      className="text-sm border border-black/20 px-3 py-1.5 hover:border-black transition-colors flex items-center gap-1 shrink-0">
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
                            <p className="text-sm font-medium uppercase tracking-widest text-stone-500">{m.label}</p>
                            <p className="text-base font-semibold mt-0.5">{m.value}</p>
                          </div>
                        ))}
                      </div>
                      {followup.testimonial && followup.testimonial_consent && (
                        <div className="border-t border-black/10 px-5 py-4 bg-stone-50/50">
                          <blockquote className="text-sm italic text-stone-700 leading-relaxed">
                            &ldquo;{followup.testimonial}&rdquo;
                          </blockquote>
                          <p className="text-sm text-stone-500 mt-2 flex items-center gap-1">
                            <span>✓</span> Consent given to share publicly
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {!followup && (
                    <div className="border-t border-black/10 px-5 py-3">
                      <p className="text-sm text-stone-500">No follow-up response yet.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedApps.length === 0 && (
        <p className="text-sm text-stone-500">No selected recipients yet. Impact data is collected automatically from artists after the programme completes.</p>
      )}

      {void profileMap}
    </div>
  );
}

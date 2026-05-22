"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, SlidersHorizontal, Download, Bell } from "lucide-react";
import { BatchNotificationPanel } from "./BatchNotificationPanel";
import { KanbanView } from "./pipeline/KanbanView";
import { TableView } from "./pipeline/TableView";
import { TriageView } from "./pipeline/TriageView";
import { ApplicantPanel } from "./ApplicantPanel";
import { CollaboratorsPanel } from "./CollaboratorsPanel";
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

type ViewMode = "kanban" | "table" | "triage";
type TabId = "pipeline" | "analytics" | "impact" | "collaborators";

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

interface Props {
  opp: OpportunityShape & {
    profile_id: string;
    status: string;
    routing_type: string;
  };
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
    const qRows: string[] = questions.map((q: { id: string; label: string }) => answers[q.id] ?? "");
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
      ...qRows,
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
  const [localApps, setLocalApps] = useState(apps);

  const openApp = openAppId ? localApps.find((a) => a.id === openAppId) ?? null : null;

  function handleStatusChange(appId: string, status: string) {
    setLocalApps((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)));
  }

  const filtered = statusFilter
    ? localApps.filter((a) => a.status === statusFilter)
    : localApps;

  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, localApps.filter((a) => a.status === s).length])
  );

  const isPipeline = opp.routing_type === "pipeline";

  const TABS: { id: TabId; label: string }[] = [
    { id: "pipeline", label: `Applications${localApps.length > 0 ? ` (${localApps.length})` : ""}` },
    { id: "analytics", label: "Analytics" },
    { id: "impact", label: "Impact" },
    { id: "collaborators", label: "Collaborators" },
  ];

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background border-b border-black">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/partner/dashboard" className="text-xs text-stone-400 hover:text-foreground transition-colors shrink-0">
                ← Dashboard
              </Link>
              <span className="text-stone-300 shrink-0">·</span>
              <h1 className="text-sm font-semibold truncate">{opp.title}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
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
                <Link
                  href={`/partner/opportunities/${opportunityId}/manage`}
                  className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors"
                >
                  Edit listing
                </Link>
              )}
            </div>
          </div>
          {/* Tab nav */}
          <div className="flex items-center gap-0 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-black text-foreground font-medium"
                    : "border-transparent text-stone-400 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Pipeline tab */}
        {tab === "pipeline" && (
          <div className="space-y-4">
            {/* Stage filter strip + view switcher */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter(null)}
                  className={`text-xs px-3 py-1.5 border transition-colors ${
                    statusFilter === null ? "border-black bg-black text-white" : "border-stone-200 hover:border-black"
                  }`}
                >
                  All ({localApps.length})
                </button>
                {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                    className={`text-xs px-3 py-1.5 border transition-colors ${
                      statusFilter === s ? "border-black bg-black text-white" : "border-stone-200 hover:border-black"
                    }`}
                  >
                    {STATUS_LABELS[s]} ({counts[s]})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportCSV(localApps, opp)}
                  className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-foreground transition-colors px-2 py-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <div className="flex border border-black/20">
                  {(isPipeline ? (["table", "kanban", "triage"] as ViewMode[]) : (["table"] as ViewMode[])).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      className={`px-2.5 py-1.5 transition-colors ${
                        view === v ? "bg-black text-white" : "hover:bg-muted"
                      }`}
                      title={v.charAt(0).toUpperCase() + v.slice(1)}
                    >
                      {v === "table" && <List className="w-3.5 h-3.5" />}
                      {v === "kanban" && <LayoutGrid className="w-3.5 h-3.5" />}
                      {v === "triage" && <SlidersHorizontal className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Views */}
            {view === "table" && (
              <TableView
                apps={filtered}
                onOpenApp={setOpenAppId}
                onStatusChange={handleStatusChange}
              />
            )}
            {view === "kanban" && (
              <KanbanView
                apps={filtered}
                onOpenApp={setOpenAppId}
                onStatusChange={handleStatusChange}
              />
            )}
            {view === "triage" && (
              <TriageView
                apps={filtered}
                onOpenApp={setOpenAppId}
                onStatusChange={handleStatusChange}
              />
            )}
          </div>
        )}

        {/* Analytics tab */}
        {tab === "analytics" && (
          <AnalyticsTab apps={localApps} />
        )}

        {/* Impact tab */}
        {tab === "impact" && (
          <ImpactTab followups={followups} apps={localApps} />
        )}

        {/* Collaborators tab */}
        {tab === "collaborators" && (
          <CollaboratorsPanel
            opportunityId={opportunityId}
            initialCollaborators={collaborators}
            isOwner={isOwner}
          />
        )}
      </div>

      {/* Notification batch panel */}
      {showNotifications && (
        <BatchNotificationPanel
          opportunityId={opportunityId}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Application detail overlay */}
      {openApp && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpenAppId(null)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-3xl bg-background overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

function exportAnalyticsCSV(apps: EnrichedApp[]) {
  const total = apps.length;
  if (total === 0) return;

  const byStatus = STATUS_ORDER.map((s) => ({
    label: STATUS_LABELS[s],
    count: apps.filter((a) => a.status === s).length,
  }));
  const byCareer = groupBy(apps, (a) => a.artist?.career_stage ?? "Unknown");
  const byDiscipline = groupByMulti(apps, (a) => a.artist?.medium ?? []);
  const byCountry = groupBy(apps, (a) => a.artist?.country ?? "Unknown");

  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const sections: string[] = [
    ["Category", "Label", "Count", "Percent"].map(esc).join(","),
    ...byStatus.map((r) => [esc("Status"), esc(r.label), r.count, (total ? (r.count / total) * 100 : 0).toFixed(1)].join(",")),
    "",
    ...byCareer.map((r) => [esc("Career stage"), esc(r.label), r.count, (total ? (r.count / total) * 100 : 0).toFixed(1)].join(",")),
    "",
    ...byDiscipline.map((r) => [esc("Discipline"), esc(r.label), r.count, (total ? (r.count / total) * 100 : 0).toFixed(1)].join(",")),
    "",
    ...byCountry.map((r) => [esc("Country"), esc(r.label), r.count, (total ? (r.count / total) * 100 : 0).toFixed(1)].join(",")),
  ];

  const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analytics-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AnalyticsTab({ apps }: { apps: EnrichedApp[] }) {
  const total = apps.length;

  const byStatus = STATUS_ORDER.map((s) => ({
    label: STATUS_LABELS[s],
    count: apps.filter((a) => a.status === s).length,
  })).filter((s) => s.count > 0);

  const byCareer = groupBy(apps, (a) => a.artist?.career_stage ?? "Unknown");
  const byDiscipline = groupByMulti(apps, (a) => a.artist?.medium ?? []);
  const byCountry = groupBy(apps, (a) => a.artist?.country ?? "Unknown");
  const byCity = groupBy(apps, (a) => (a.artist?.city && a.artist?.country) ? `${a.artist.city}, ${a.artist.country}` : (a.artist?.city ?? a.artist?.country ?? "Unknown"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{total} applicant{total !== 1 ? "s" : ""} total</p>
        <button
          type="button"
          onClick={() => exportAnalyticsCSV(apps)}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-foreground transition-colors border border-black/20 px-3 py-1.5 hover:border-black"
        >
          <Download className="w-3.5 h-3.5" />
          Export report
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-5xl">
        <StatGroup title="Pipeline funnel" rows={byStatus.map((s) => ({ label: s.label, count: s.count, pct: total ? (s.count / total) * 100 : 0 }))} total={total} />
        <StatGroup title="Career stage" rows={byCareer} total={total} />
        <StatGroup title="Disciplines" rows={byDiscipline.slice(0, 8)} total={total} />
        <StatGroup title="Country" rows={byCountry.slice(0, 8)} total={total} />
        <StatGroup title="City" rows={byCity.slice(0, 8)} total={total} />
      </div>
    </div>
  );
}

function StatGroup({ title, rows, total }: { title: string; rows: { label: string; count: number; pct?: number }[]; total: number }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{title}</p>
      <div className="space-y-2">
        {rows.map((r) => {
          const pct = r.pct ?? (total ? (r.count / total) * 100 : 0);
          return (
            <div key={r.label} className="space-y-0.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-600 truncate">{r.label}</span>
                <span className="text-stone-400 ml-2 shrink-0">{r.count} ({pct.toFixed(0)}%)</span>
              </div>
              <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-xs text-stone-400">No data</p>}
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
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function groupByMulti(apps: EnrichedApp[], key: (a: EnrichedApp) => string[]) {
  const map = new Map<string, number>();
  for (const app of apps) {
    for (const k of key(app)) {
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

// ── Impact ───────────────────────────────────────────────────────────────────

const OUTCOME_KEYS: { key: keyof FollowupRow; label: string }[] = [
  { key: "further_opportunities", label: "Further opportunities" },
  { key: "exhibitions",           label: "Exhibitions" },
  { key: "press_coverage",        label: "Press coverage" },
  { key: "income_from_practice",  label: "Income from practice" },
  { key: "community_projects",    label: "Community projects" },
];

function ImpactTab({ followups, apps }: { followups: FollowupRow[]; apps: EnrichedApp[] }) {
  const responded = followups.filter((f) => f.completed_at);
  const testimonials = followups.filter((f) => f.testimonial && f.testimonial_consent);
  const selectedCount = apps.filter((a) =>
    ["selected", "approved_pending_assets", "production_ready"].includes(a.status)
  ).length;

  const profileMap = new Map(apps.map((a) => [a.artist?.id ?? "", a.artist]));

  return (
    <div className="space-y-10 max-w-3xl">
      {/* Top stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-black/10 p-4 text-center">
          <p className="text-2xl font-semibold">{selectedCount}</p>
          <p className="text-xs text-stone-500 mt-1">Selected artists</p>
        </div>
        <div className="border border-black/10 p-4 text-center">
          <p className="text-2xl font-semibold">{followups.length}</p>
          <p className="text-xs text-stone-500 mt-1">Follow-ups sent</p>
        </div>
        <div className="border border-black/10 p-4 text-center">
          <p className="text-2xl font-semibold">{responded.length}</p>
          <p className="text-xs text-stone-500 mt-1">Responses received</p>
        </div>
      </div>

      {/* Outcome buckets */}
      {responded.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Reported outcomes</p>
          <div className="divide-y divide-black/10 border border-black/10">
            {OUTCOME_KEYS.map(({ key, label }) => {
              const entries = responded
                .filter((f) => f[key] && String(f[key]).trim())
                .map((f) => ({
                  text: String(f[key]).trim(),
                  artistName: profileMap.get(f.profile_id)?.full_name
                    ?? profileMap.get(f.profile_id)?.username
                    ?? null,
                }));
              return (
                <div key={key} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{label}</p>
                    <span className="text-xs text-stone-400">{entries.length} of {responded.length} reported</span>
                  </div>
                  {entries.length > 0 && (
                    <ul className="space-y-1 pl-3">
                      {entries.map((e, i) => (
                        <li key={i} className="text-xs text-stone-600">
                          {e.artistName && (
                            <span className="text-stone-400 mr-1.5">{e.artistName}:</span>
                          )}
                          {e.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Testimonials</p>
          {testimonials.map((f) => {
            const artist = profileMap.get(f.profile_id);
            return (
              <blockquote key={f.id} className="border-l-2 border-black pl-4 space-y-1">
                <p className="text-sm">&ldquo;{f.testimonial}&rdquo;</p>
                {artist && (
                  <p className="text-xs text-stone-400">{artist.full_name ?? artist.username}</p>
                )}
              </blockquote>
            );
          })}
        </div>
      )}

      {responded.length === 0 && followups.length === 0 && (
        <p className="text-sm text-stone-400">No follow-ups sent yet. These are sent automatically to selected artists after the programme completes.</p>
      )}

      {followups.length > 0 && responded.length === 0 && (
        <p className="text-sm text-stone-400">{followups.length} follow-up{followups.length !== 1 ? "s" : ""} sent — no responses yet.</p>
      )}
    </div>
  );
}

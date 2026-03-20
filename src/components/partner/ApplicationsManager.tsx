"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApplicantPanel } from "./ApplicantPanel";
import type { CustomField, PipelineConfig } from "@/types/database";

export interface EnrichedApp {
  id: string;
  status: string;
  created_at: string;
  artwork: { id: string; url: string; caption: string | null } | null;
  submitted_image_url: string | null;
  custom_answers: Record<string, string>;
  highres_asset_url: string | null;
  artist: {
    id: string;
    username: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    bio: string | null;
    medium: string[] | null;
    career_stage: string | null;
    country: string | null;
    cv_url: string | null;
    exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null;
    received_grants: string[] | null;
    is_patronage_supported: boolean;
  } | null;
}

interface OpportunityShape {
  id: string;
  title: string;
  type?: string;
  slug?: string | null;
  custom_fields: CustomField[];
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
}

interface Props {
  apps: EnrichedApp[];
  opp: OpportunityShape;
  opportunityId: string;
}

const STATUS_OPTIONS = [
  { val: "pending", label: "New" },
  { val: "shortlisted", label: "Shortlist" },
  { val: "selected", label: "Select" },
  { val: "approved_pending_assets", label: "Approve" },
  { val: "rejected", label: "Reject" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  shortlisted: "Shortlisted",
  selected: "Selected",
  approved_pending_assets: "Awaiting File",
  production_ready: "Download Ready",
  rejected: "Rejected",
};

const STATUS_ORDER = ["pending", "shortlisted", "selected", "approved_pending_assets", "production_ready", "rejected"];

// ── CSV helpers ─────────────────────────────────────────────────────────────

function getQuestionFields(opp: OpportunityShape) {
  return opp.pipeline_config?.questions?.length
    ? opp.pipeline_config.questions.map((q) => ({ id: q.id, label: q.label }))
    : (opp.custom_fields ?? []).map((f) => ({ id: f.id, label: f.question }));
}

function escapeCSV(val: string) {
  return `"${val.replace(/"/g, '""')}"`;
}

function exportCSV(apps: EnrichedApp[], opp: OpportunityShape) {
  const questions = getQuestionFields(opp);
  const headers = [
    "Name", "Email", "Username", "Career Stage", "Disciplines",
    "Location", "Application Date", "Status",
    "Profile URL", "CV URL", "Submitted Image URL",
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
      a?.country ?? "",
      new Date(app.created_at).toLocaleDateString("en-NZ"),
      STATUS_LABELS[app.status] ?? app.status,
      a?.username ? `https://patronage.nz/${a.username}` : "",
      a?.cv_url ?? "",
      app.artwork?.url ?? app.submitted_image_url ?? "",
      ...questions.map((q) => answers[q.id] ?? ""),
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) => row.map(String).map(escapeCSV).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = opp.slug ?? opp.id;
  const date = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `${slug}-applications-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────────────────────

export function ApplicationsManager({ apps, opp, opportunityId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedApplicantId = searchParams.get("applicant");
  const urlView = searchParams.get("view") === "gallery" ? "gallery" : "table";

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "gallery">(urlView);

  const selectedApp = selectedApplicantId ? apps.find((a) => a.id === selectedApplicantId) ?? null : null;

  // ── Stats ────────────────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  const careerStageCounts: Record<string, number> = {};
  const disciplineCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};

  for (const app of apps) {
    statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
    const a = app.artist;
    if (a) {
      if (a.career_stage) careerStageCounts[a.career_stage] = (careerStageCounts[a.career_stage] ?? 0) + 1;
      for (const m of a.medium ?? []) disciplineCounts[m] = (disciplineCounts[m] ?? 0) + 1;
      if (a.country) locationCounts[a.country] = (locationCounts[a.country] ?? 0) + 1;
    }
  }

  const topDisciplines = Object.entries(disciplineCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topLocations = Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
  const topCareerStages = Object.entries(careerStageCounts).sort((a, b) => b[1] - a[1]);

  // ── Filtered list ────────────────────────────────────────────────────────
  const filteredApps = statusFilter ? apps.filter((a) => a.status === statusFilter) : apps;

  const closeUrl = `/partner/dashboard/${opportunityId}`;

  function handleViewChange(v: "table" | "gallery") {
    setView(v);
    // keep applicant param if open
    const params = new URLSearchParams(searchParams.toString());
    if (v === "gallery") params.set("view", "gallery");
    else params.delete("view");
    router.push(`/partner/dashboard/${opportunityId}?${params.toString()}`);
  }

  if (apps.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No applications yet.</p>;
  }

  return (
    <>
      {/* ── Controls row ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        {/* View toggle */}
        <div className="flex border border-black">
          <button
            type="button"
            onClick={() => handleViewChange("table")}
            className={`text-xs px-3 py-1.5 transition-colors ${view === "table" ? "bg-black text-white" : "hover:bg-muted"}`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("gallery")}
            className={`text-xs px-3 py-1.5 border-l border-black transition-colors ${view === "gallery" ? "bg-black text-white" : "hover:bg-muted"}`}
          >
            Gallery
          </button>
        </div>

        {/* CSV export */}
        <button
          type="button"
          onClick={() => exportCSV(apps, opp)}
          className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
        >
          Export CSV ↓
        </button>
      </div>

      {/* ── Stats panel ───────────────────────────────────────────────────── */}
      <div className="border border-black p-5 space-y-5">
        {/* Status breakdown — clickable to filter */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 items-end">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`text-center group transition-opacity ${statusFilter !== null ? "opacity-40 hover:opacity-70" : ""}`}
          >
            <p className="text-2xl font-semibold">{apps.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Total</p>
          </button>
          <div className="w-px bg-black/10 self-stretch hidden sm:block" />
          {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`text-center transition-opacity ${statusFilter !== null && statusFilter !== s ? "opacity-40 hover:opacity-70" : ""}`}
            >
              <p className={`text-2xl font-semibold ${statusFilter === s ? "underline underline-offset-2" : ""}`}>
                {statusCounts[s]}
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{STATUS_LABELS[s] ?? s}</p>
            </button>
          ))}
        </div>

        {/* Distribution columns */}
        {(topCareerStages.length > 0 || topDisciplines.length > 0 || topLocations.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-black/10">
            {topCareerStages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Career Stage</p>
                {topCareerStages.map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between text-sm">
                    <span>{stage}</span>
                    <span className="text-muted-foreground font-mono text-xs">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {topDisciplines.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Disciplines</p>
                {topDisciplines.map(([discipline, count]) => (
                  <div key={discipline} className="flex items-center justify-between text-sm">
                    <span>{discipline}</span>
                    <span className="text-muted-foreground font-mono text-xs">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {topLocations.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Location</p>
                {topLocations.map(([loc, count]) => (
                  <div key={loc} className="flex items-center justify-between text-sm">
                    <span>{loc}</span>
                    <span className="text-muted-foreground font-mono text-xs">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active filter indicator */}
        {statusFilter && (
          <div className="flex items-center gap-2 pt-2 border-t border-black/10">
            <span className="text-xs text-muted-foreground">
              Showing {filteredApps.length} {STATUS_LABELS[statusFilter] ?? statusFilter} application{filteredApps.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* ── Application list ──────────────────────────────────────────────── */}
      {filteredApps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No applications match this filter.</p>
      ) : view === "gallery" ? (
        /* Gallery view */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredApps.map((app) => {
            const imageUrl = app.artwork?.url ?? app.submitted_image_url ?? null;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("view", "gallery");
                  params.set("applicant", app.id);
                  router.push(`/partner/dashboard/${opportunityId}?${params.toString()}`);
                }}
                className="border border-black overflow-hidden group text-left"
              >
                {imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imageUrl}
                    alt={app.artwork?.caption ?? app.artist?.full_name ?? ""}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-muted flex items-center justify-center">
                    <span className="text-2xl font-semibold text-muted-foreground">
                      {(app.artist?.full_name ?? app.artist?.username ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="p-2 space-y-0.5">
                  <p className="text-xs font-semibold truncate">{app.artist?.full_name ?? app.artist?.username}</p>
                  {app.artist?.career_stage && (
                    <p className="text-xs text-muted-foreground truncate">{app.artist.career_stage}</p>
                  )}
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 leading-none">{STATUS_LABELS[app.status] ?? app.status}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="border-t border-black">
          {filteredApps.map((app) => {
            const imageUrl = app.artwork?.url ?? app.submitted_image_url ?? null;
            return (
              <button
                key={app.id}
                type="button"
                onClick={() => {
                  router.push(`/partner/dashboard/${opportunityId}?applicant=${app.id}`);
                }}
                className="w-full flex items-center gap-4 border-b border-black py-3 px-2 hover:bg-muted/30 transition-colors group text-left"
              >
                {/* Thumbnail */}
                {imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={imageUrl}
                    alt=""
                    className="w-10 h-10 object-cover border border-black/20 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 bg-muted border border-black/20 shrink-0 flex items-center justify-center">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {(app.artist?.full_name ?? app.artist?.username ?? "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {app.artist?.full_name ?? app.artist?.username ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[app.artist?.career_stage, app.artist?.country].filter(Boolean).join(" · ") || `@${app.artist?.username}`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
                </span>
                <span className="text-xs bg-muted px-2 py-0.5 leading-none whitespace-nowrap">
                  {STATUS_LABELS[app.status] ?? app.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Applicant panel (modal) */}
      {selectedApp && (
        <ApplicantPanel
          application={selectedApp as unknown as Parameters<typeof ApplicantPanel>[0]["application"]}
          opportunity={opp}
          closeUrl={closeUrl}
        />
      )}
    </>
  );
}

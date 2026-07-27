"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApplicantPanel } from "./ApplicantPanel";
import type { CustomField, PipelineConfig } from "@/types/database";
import { getAgeBracket, IDENTITY_TAGS } from "@/lib/constants/demographics";

// Named for the legacy creative_work_ids column, but these rows come from
// `artworks` (the portfolio picker sources from there, not creative_works —
// see ApplyButton.tsx) — always images, no content_type/embed variants.
export interface CreativeWorkLite {
  id: string;
  title: string | null;
  caption: string | null;
  url: string;
  thumb_url: string | null;
}

export interface EnrichedApp {
  id: string;
  status: string;
  created_at: string;
  artwork: { id: string; url: string; caption: string | null } | null;
  submitted_image_url: string | null;
  /** All portfolio works the artist picked (Step 3 "Portfolio images" pick count). */
  creative_works: CreativeWorkLite[] | null;
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
    city: string | null;
    country: string | null;
    cv_url: string | null;
    exhibition_history: Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null;
    received_grants: string[] | null;
    is_patronage_supported: boolean;
    year_of_birth: number | null;
    identity_tags: string[];
  } | null;
}

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

export interface OpportunityShape {
  id: string;
  title: string;
  type?: string;
  slug?: string | null;
  custom_fields: CustomField[];
  show_badges_in_submission: boolean;
  pipeline_config?: PipelineConfig | null;
  view_count?: number;
}

interface Props {
  apps: EnrichedApp[];
  opp: OpportunityShape;
  opportunityId: string;
  followups?: FollowupRow[];
}

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

function exportCSV(apps: EnrichedApp[], opp: OpportunityShape) {
  const questions = getQuestionFields(opp);
  const headers = [
    "Name", "Email", "Username", "Career Stage", "Disciplines",
    "City", "Country", "Application Date", "Status", "Age Bracket",
    "Identity Tags", "Profile URL", "CV URL", "Submitted Image URL",
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
      getAgeBracket(a?.year_of_birth ?? null) ?? "",
      (a?.identity_tags ?? []).join(", "),
      a?.username ? `https://patronage.nz/${a.username}` : "",
      a?.cv_url ?? "",
      app.artwork?.url ?? app.submitted_image_url ?? "",
      ...questions.map((q) => answers[q.id] ?? ""),
    ];
  });

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csvContent = [headers, ...rows]
    .map((row) => row.map(String).map(escape).join(","))
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

// ── Funnel bar ───────────────────────────────────────────────────────────────

function FunnelBar({ label, count, pct, isFirst }: { label: string; count: number; pct: number | null; isFirst: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-24 shrink-0 text-right">
        <span className="text-xl font-semibold tabular-nums">{count.toLocaleString()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {!isFirst && pct !== null && (
            <span className="text-xs text-muted-foreground">({pct.toFixed(1)}%)</span>
          )}
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-black rounded-full transition-all"
            style={{ width: `${isFirst ? 100 : (pct ?? 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Stat row ─────────────────────────────────────────────────────────────────

function StatRow({ label, count, pct }: { label: string; count: number; pct?: number }) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="truncate">{label}</span>
      <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
        {count}{pct !== undefined ? ` (${pct}%)` : ""}
      </span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function ApplicationsManager({ apps, opp, opportunityId, followups = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedAppId, setSelectedAppId] = useState<string | null>(
    () => searchParams.get("applicant") ?? null
  );
  const [view, setView] = useState<"table" | "gallery">(
    () => (searchParams.get("view") === "gallery" ? "gallery" : "table")
  );
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"applications" | "impact">("applications");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc" | "career_stage" | "status" | "city">("date_desc");

  const selectedApp = selectedAppId ? apps.find((a) => a.id === selectedAppId) ?? null : null;

  function openApplicant(id: string) {
    setSelectedAppId(id);
  }

  function closeApplicant() {
    setSelectedAppId(null);
    router.refresh();
  }

  // ── Engagement funnel ────────────────────────────────────────────────────
  const viewCount = opp.view_count ?? 0;
  const appCount = apps.length;
  const shortlistedCount = apps.filter((a) => a.status === "shortlisted").length;
  const selectedCount = apps.filter((a) =>
    ["selected", "approved_pending_assets", "production_ready"].includes(a.status)
  ).length;

  const appRate = viewCount > 0 ? (appCount / viewCount) * 100 : null;
  const shortlistRate = appCount > 0 ? (shortlistedCount / appCount) * 100 : null;
  const selectionRate = appCount > 0 ? (selectedCount / appCount) * 100 : null;

  // ── Stats ────────────────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  const careerStageCounts: Record<string, number> = {};
  const disciplineCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};
  const ageBracketCounts: Record<string, number> = {};
  const identityTagCounts: Record<string, number> = {};
  let appsWithAgeData = 0;
  let appsWithIdentityData = 0;

  for (const app of apps) {
    statusCounts[app.status] = (statusCounts[app.status] ?? 0) + 1;
    const a = app.artist;
    if (a) {
      if (a.career_stage) careerStageCounts[a.career_stage] = (careerStageCounts[a.career_stage] ?? 0) + 1;
      for (const m of a.medium ?? []) disciplineCounts[m] = (disciplineCounts[m] ?? 0) + 1;

      const location = [a.city, a.country].filter(Boolean).join(", ");
      if (location) cityCounts[location] = (cityCounts[location] ?? 0) + 1;

      const bracket = getAgeBracket(a.year_of_birth);
      if (bracket) {
        ageBracketCounts[bracket] = (ageBracketCounts[bracket] ?? 0) + 1;
        appsWithAgeData++;
      }

      if (a.identity_tags && a.identity_tags.length > 0) {
        appsWithIdentityData++;
        for (const tag of a.identity_tags) {
          identityTagCounts[tag] = (identityTagCounts[tag] ?? 0) + 1;
        }
      }
    }
  }

  const topDisciplines = Object.entries(disciplineCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topCareerStages = Object.entries(careerStageCounts).sort((a, b) => b[1] - a[1]);
  const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
  const topCities = sortedCities.slice(0, 8);
  const otherCitiesCount = sortedCities.slice(8).reduce((sum, [, c]) => sum + c, 0);

  // Age brackets in canonical order
  const AGE_BRACKET_ORDER = ["Under 25", "25–34", "35–44", "45–54", "55+"];
  const ageBracketRows = AGE_BRACKET_ORDER
    .map((label) => ({ label, count: ageBracketCounts[label] ?? 0 }))
    .filter((r) => r.count > 0);

  // Identity tags sorted by frequency
  const identityTagRows = Object.entries(identityTagCounts)
    .sort((a, b) => b[1] - a[1]);

  const searchLower = searchQuery.toLowerCase().trim();
  const filteredApps = apps
    .filter((a) => !statusFilter || a.status === statusFilter)
    .filter((a) => {
      if (!searchLower) return true;
      const name = (a.artist?.full_name ?? a.artist?.username ?? "").toLowerCase();
      const city = (a.artist?.city ?? "").toLowerCase();
      const country = (a.artist?.country ?? "").toLowerCase();
      const disciplines = (a.artist?.medium ?? []).join(" ").toLowerCase();
      return name.includes(searchLower) || city.includes(searchLower) || country.includes(searchLower) || disciplines.includes(searchLower);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name_asc": return (a.artist?.full_name ?? a.artist?.username ?? "").localeCompare(b.artist?.full_name ?? b.artist?.username ?? "");
        case "name_desc": return (b.artist?.full_name ?? b.artist?.username ?? "").localeCompare(a.artist?.full_name ?? a.artist?.username ?? "");
        case "career_stage": return (a.artist?.career_stage ?? "").localeCompare(b.artist?.career_stage ?? "");
        case "status": return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        case "city": return (a.artist?.city ?? "").localeCompare(b.artist?.city ?? "");
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // date_desc
      }
    });

  // ── Impact data ──────────────────────────────────────────────────────────
  const completedFollowups = followups.filter((f) => f.completed_at);
  const sentFollowups = followups.filter((f) => f.sent_at);
  const testimonials = completedFollowups.filter((f) => f.testimonial_consent && f.testimonial);
  const incomeCounts: Record<string, number> = {};
  let furtherOppsCount = 0;
  let exhibitionsCount = 0;
  let pressCount = 0;
  let communityCount = 0;
  for (const f of completedFollowups) {
    if (f.income_from_practice) incomeCounts[f.income_from_practice] = (incomeCounts[f.income_from_practice] ?? 0) + 1;
    if (f.further_opportunities?.trim()) furtherOppsCount++;
    if (f.exhibitions?.trim()) exhibitionsCount++;
    if (f.press_coverage?.trim()) pressCount++;
    if (f.community_projects?.trim()) communityCount++;
  }

  const totalSelected = apps.filter((a) =>
    ["selected", "approved_pending_assets", "production_ready"].includes(a.status)
  ).length;

  if (apps.length === 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No applications yet.</p>;
  }

  return (
    <>
      {/* ── Engagement funnel ──────────────────────────────────────────────── */}
      {viewCount > 0 && (
        <div className="border border-black p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Engagement Funnel</p>
          <div className="space-y-2.5">
            <FunnelBar label="Views" count={viewCount} pct={null} isFirst />
            <FunnelBar label="Applications" count={appCount} pct={appRate} isFirst={false} />
            <FunnelBar label="Shortlisted" count={shortlistedCount} pct={shortlistRate} isFirst={false} />
            <FunnelBar label="Selected" count={selectedCount} pct={selectionRate} isFirst={false} />
          </div>
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      {followups.length > 0 && (
        <div className="flex border-b border-black/20 gap-6">
          {(["applications", "impact"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`text-sm pb-2 border-b-2 transition-colors cursor-pointer capitalize ${
                activeTab === tab ? "border-black font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "applications" ? `Applications (${apps.length})` : "Impact"}
            </button>
          ))}
        </div>
      )}

      {/* ── Impact tab ─────────────────────────────────────────────────────── */}
      {activeTab === "impact" && (
        <div className="space-y-8">
          {/* Summary counts */}
          <div className="border border-black p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Follow-up Summary</p>
            <div className="flex flex-wrap gap-6 items-end">
              <div className="text-center">
                <p className="text-2xl font-semibold">{totalSelected}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Funded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{sentFollowups.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Contacted</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{completedFollowups.length}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Responded</p>
              </div>
            </div>

            {completedFollowups.length > 0 && (
              <div className="pt-4 border-t border-black/10 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Outcomes reported</p>
                {furtherOppsCount > 0 && <p className="text-sm">{furtherOppsCount} of {completedFollowups.length} reported winning or being shortlisted for further opportunities.</p>}
                {exhibitionsCount > 0 && <p className="text-sm">{exhibitionsCount} of {completedFollowups.length} reported exhibiting new work.</p>}
                {pressCount > 0 && <p className="text-sm">{pressCount} of {completedFollowups.length} reported press or media coverage.</p>}
                {communityCount > 0 && <p className="text-sm">{communityCount} of {completedFollowups.length} reported community project involvement.</p>}
                {Object.keys(incomeCounts).length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium pt-1">Income from practice:</p>
                    {Object.entries(incomeCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => (
                      <p key={label} className="text-sm text-muted-foreground pl-2">
                        {label}: {count} artist{count !== 1 ? "s" : ""}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Testimonials */}
          {testimonials.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Artist Testimonials</p>
              {testimonials.map((f) => {
                const app = apps.find((a) => a.artist?.id === f.profile_id);
                const name = app?.artist?.full_name ?? app?.artist?.username ?? "Artist";
                return (
                  <div key={f.id} className="border border-black/20 p-4 space-y-2">
                    <blockquote className="text-sm italic leading-relaxed">&ldquo;{f.testimonial}&rdquo;</blockquote>
                    <p className="text-xs text-muted-foreground">— {name}</p>
                  </div>
                );
              })}
            </div>
          )}

          {completedFollowups.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {sentFollowups.length > 0
                ? `${sentFollowups.length} follow-up${sentFollowups.length !== 1 ? "s" : ""} sent — no responses yet.`
                : "No follow-ups sent yet. Follow-ups are sent automatically at 6 and 12 months post-selection."}
            </p>
          )}
        </div>
      )}

      {/* ── Applications tab ───────────────────────────────────────────────── */}
      {activeTab === "applications" && (
        <>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <div className="flex border border-black shrink-0">
              <button
                type="button"
                onClick={() => setView("table")}
                className={`text-xs px-3 py-1.5 transition-colors cursor-pointer ${
                  view === "table" ? "bg-black text-white" : "hover:bg-black hover:text-white"
                }`}
              >
                Table
              </button>
              <button
                type="button"
                onClick={() => setView("gallery")}
                className={`text-xs px-3 py-1.5 border-l border-black transition-colors cursor-pointer ${
                  view === "gallery" ? "bg-black text-white" : "hover:bg-black hover:text-white"
                }`}
              >
                Gallery
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-40">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, city, discipline…"
                className="w-full text-xs border border-black px-3 py-1.5 bg-transparent placeholder:text-muted-foreground focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-black px-2 py-1.5 bg-transparent cursor-pointer focus:outline-none shrink-0"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="career_stage">Career stage</option>
              <option value="status">Status</option>
              <option value="city">City</option>
            </select>

            <button
              type="button"
              onClick={() => exportCSV(apps, opp)}
              className="text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer shrink-0"
            >
              Export CSV ↓
            </button>
          </div>

          {/* Stats panel */}
          <div className="border border-black p-5 space-y-5">
            {/* Status breakdown — clickable to filter */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 items-end">
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className={`text-center cursor-pointer transition-opacity ${statusFilter !== null ? "opacity-40 hover:opacity-70" : ""}`}
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
                  className={`text-center cursor-pointer transition-opacity ${statusFilter !== null && statusFilter !== s ? "opacity-40 hover:opacity-70" : ""}`}
                >
                  <p className={`text-2xl font-semibold ${statusFilter === s ? "underline underline-offset-2" : ""}`}>
                    {statusCounts[s]}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">{STATUS_LABELS[s] ?? s}</p>
                </button>
              ))}
            </div>

            {/* Distribution columns */}
            {(topCareerStages.length > 0 || topDisciplines.length > 0 || topCities.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-black/10">
                {topCareerStages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Career Stage</p>
                    {topCareerStages.map(([stage, count]) => (
                      <StatRow key={stage} label={stage} count={count} />
                    ))}
                  </div>
                )}
                {topDisciplines.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Disciplines</p>
                    {topDisciplines.map(([discipline, count]) => (
                      <StatRow key={discipline} label={discipline} count={count} />
                    ))}
                  </div>
                )}
                {topCities.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Location</p>
                    {topCities.map(([loc, count]) => (
                      <StatRow key={loc} label={loc} count={count} />
                    ))}
                    {otherCitiesCount > 0 && (
                      <p className="text-xs text-muted-foreground">{otherCitiesCount} from other locations</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Age bracket breakdown */}
            {ageBracketRows.length > 0 && (
              <div className="pt-4 border-t border-black/10">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Age Bracket</p>
                  <p className="text-xs text-muted-foreground">{apps.length} applicants — {appsWithAgeData} with age data</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {ageBracketRows.map(({ label, count }) => {
                    const pct = appsWithAgeData > 0 ? Math.round((count / appsWithAgeData) * 100) : 0;
                    return (
                      <div key={label} className="border border-black/10 p-2 text-center">
                        <p className="text-lg font-semibold">{count}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Identity tags breakdown */}
            {identityTagRows.length > 0 && (
              <div className="pt-4 border-t border-black/10">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Identity</p>
                  <p className="text-xs text-muted-foreground">{appsWithIdentityData} of {apps.length} applicants provided identity data</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Percentages sum to more than 100% — applicants may select multiple.</p>
                <div className="space-y-1.5">
                  {identityTagRows.map(([tag, count]) => {
                    const pct = apps.length > 0 ? Math.round((count / apps.length) * 100) : 0;
                    return (
                      <div key={tag} className="flex items-center gap-3">
                        <div className="w-36 shrink-0 text-sm truncate">{tag}</div>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-black/60 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-16 text-right">{count} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
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
                  className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Application list */}
          {filteredApps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {searchQuery ? `No results for "${searchQuery}".` : "No applications match this filter."}
            </p>
          ) : view === "gallery" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredApps.map((app) => {
                const imageUrl = app.artwork?.url ?? app.submitted_image_url ?? null;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => openApplicant(app.id)}
                    className="border border-black overflow-hidden text-left cursor-pointer hover:border-black/60 transition-colors"
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
            <div className="border-t border-black">
              {filteredApps.map((app) => {
                const imageUrl = app.artwork?.url ?? app.submitted_image_url ?? null;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => openApplicant(app.id)}
                    className="w-full flex items-center gap-4 border-b border-black py-3 px-2 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                  >
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
                        {[app.artist?.career_stage, [app.artist?.city, app.artist?.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || `@${app.artist?.username}`}
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
        </>
      )}

      {/* Applicant panel — opens instantly from pre-loaded data */}
      {selectedApp && (
        <ApplicantPanel
          application={selectedApp as unknown as Parameters<typeof ApplicantPanel>[0]["application"]}
          opportunity={opp}
          closeUrl={`/partner/dashboard/${opportunityId}`}
          onClose={closeApplicant}
        />
      )}
    </>
  );
}

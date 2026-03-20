import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ApplicantPanel } from "@/components/partner/ApplicantPanel";
import type { Metadata } from "next";
import type { CustomField } from "@/types/database";
import { isAdmin } from "@/lib/admin";

interface Props {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<{ applicant?: string; view?: string }>;
}

export const metadata: Metadata = { title: "Applications — Patronage" };

const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  shortlisted: "Shortlisted",
  selected: "Selected",
  approved_pending_assets: "Awaiting File",
  production_ready: "Download Ready",
  rejected: "Rejected",
};

const STATUS_ORDER = ["pending", "shortlisted", "selected", "approved_pending_assets", "production_ready", "rejected"];

interface AppRow {
  id: string;
  status: string;
  created_at: string;
  artwork_id: string | null;
  submitted_image_url: string | null;
  custom_answers: Record<string, string>;
  highres_asset_url: string | null;
  artist_id: string;
  artwork: { id: string; url: string; caption: string | null } | null;
}

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  medium: string[] | null;
  career_stage: string | null;
  country: string | null;
  cv_url: string | null;
  exhibition_history: Array<{ type: string; title: string; venue: string; location: string; year: number }> | null;
  received_grants: string[] | null;
  is_patronage_supported: boolean;
}

export default async function PartnerOpportunityPage({ params, searchParams }: Props) {
  const { opportunityId } = await params;
  const sp = await searchParams;
  const selectedApplicantId = sp.applicant ?? null;
  const view = sp.view === "gallery" ? "gallery" : "table";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: oppData }, adminUser] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, organiser, type, profile_id, routing_type, custom_fields, show_badges_in_submission, pipeline_config")
      .eq("id", opportunityId)
      .single(),
    isAdmin(),
  ]);

  // Allow: owner of the opportunity OR admins
  if (!oppData || (oppData.profile_id !== user.id && !adminUser)) notFound();

  const opp = {
    id: oppData.id as string,
    title: oppData.title as string,
    organiser: oppData.organiser as string,
    type: oppData.type as string,
    profile_id: oppData.profile_id as string,
    routing_type: (oppData.routing_type ?? "external") as string,
    custom_fields: (oppData.custom_fields ?? []) as CustomField[],
    show_badges_in_submission: (oppData.show_badges_in_submission ?? true) as boolean,
    pipeline_config: (oppData.pipeline_config ?? null) as import("@/types/database").PipelineConfig | null,
  };

  // Get applications with artwork
  const { data: appsData } = await supabase
    .from("opportunity_applications")
    .select("id, status, created_at, artwork_id, submitted_image_url, custom_answers, highres_asset_url, artist_id, artwork:artwork_id(id, url, caption)")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: false });

  const apps = (appsData ?? []) as unknown as AppRow[];

  // Fetch profiles separately for the artist IDs
  const artistIds = [...new Set(apps.map((a) => a.artist_id))];
  const { data: profilesData } = artistIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url, bio, medium, career_stage, country, cv_url, exhibition_history, received_grants, is_patronage_supported")
        .in("id", artistIds)
    : { data: [] };

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profilesData ?? []) as unknown as ProfileRow[]) {
    profileMap.set(p.id, p);
  }

  // Build enriched apps
  const enrichedApps = apps.map((app) => ({
    ...app,
    artist: profileMap.get(app.artist_id) ?? null,
  }));

  const selectedApp = selectedApplicantId
    ? enrichedApps.find((a) => a.id === selectedApplicantId) ?? null
    : null;

  // ── Stats computation ────────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  const careerStageCounts: Record<string, number> = {};
  const disciplineCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};

  for (const app of enrichedApps) {
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

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Link href="/partner/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Partner Dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{opp.title}</h1>
          <p className="text-sm text-muted-foreground">{enrichedApps.length} application{enrichedApps.length !== 1 ? "s" : ""}</p>
        </div>
        {/* View toggle */}
        <div className="flex border border-black">
          <Link
            href={`/partner/dashboard/${opportunityId}?view=table`}
            className={`text-xs px-3 py-1.5 transition-colors ${view === "table" ? "bg-black text-white" : "hover:bg-muted"}`}
          >
            Table
          </Link>
          <Link
            href={`/partner/dashboard/${opportunityId}?view=gallery`}
            className={`text-xs px-3 py-1.5 border-l border-black transition-colors ${view === "gallery" ? "bg-black text-white" : "hover:bg-muted"}`}
          >
            Gallery
          </Link>
        </div>
      </div>

      {/* ── Stats panel ────────────────────────────────────────────────────── */}
      {enrichedApps.length > 0 && (
        <div className="border border-black p-5 space-y-5">
          {/* Status breakdown */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="text-center">
              <p className="text-2xl font-semibold">{enrichedApps.length}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Total</p>
            </div>
            <div className="w-px bg-black/10 self-stretch hidden sm:block" />
            {STATUS_ORDER.filter((s) => statusCounts[s]).map((s) => (
              <div key={s} className="text-center">
                <p className="text-2xl font-semibold">{statusCounts[s]}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{STATUS_LABELS[s] ?? s}</p>
              </div>
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
        </div>
      )}

      {/* ── Application list ────────────────────────────────────────────────── */}
      {enrichedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No applications yet.</p>
      ) : view === "gallery" ? (
        /* Gallery view */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {enrichedApps.map((app) => {
            const imageUrl = app.artwork?.url ?? app.submitted_image_url ?? null;
            return (
              <Link
                key={app.id}
                href={`/partner/dashboard/${opportunityId}?view=gallery&applicant=${app.id}`}
                className="border border-black overflow-hidden group"
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
                  {app.artwork?.caption && (
                    <p className="text-xs text-muted-foreground truncate">{app.artwork.caption}</p>
                  )}
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 leading-none">{STATUS_LABELS[app.status] ?? app.status}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* Table view */
        <div className="border-t border-black">
          {enrichedApps.map((app) => {
            const imageUrl = app.artwork?.url ?? app.submitted_image_url ?? null;
            return (
              <Link
                key={app.id}
                href={`/partner/dashboard/${opportunityId}?applicant=${app.id}`}
                className="flex items-center gap-4 border-b border-black py-3 px-2 hover:bg-muted/30 transition-colors group"
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
              </Link>
            );
          })}
        </div>
      )}

      {/* Applicant panel (modal) */}
      {selectedApp && (
        <ApplicantPanel
          application={selectedApp as unknown as Parameters<typeof ApplicantPanel>[0]["application"]}
          opportunity={opp}
          closeUrl={`/partner/dashboard/${opportunityId}${view === "gallery" ? "?view=gallery" : ""}`}
        />
      )}
    </div>
  );
}

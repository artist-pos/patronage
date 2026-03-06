import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ApplicantPanel } from "@/components/partner/ApplicantPanel";
import type { Metadata } from "next";
import type { CustomField } from "@/types/database";

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

  const { data: oppData } = await supabase
    .from("opportunities")
    .select("id, title, organiser, type, profile_id, routing_type, custom_fields, show_badges_in_submission")
    .eq("id", opportunityId)
    .single();

  if (!oppData || oppData.profile_id !== user.id) notFound();

  const opp = {
    id: oppData.id as string,
    title: oppData.title as string,
    organiser: oppData.organiser as string,
    type: oppData.type as string,
    profile_id: oppData.profile_id as string,
    routing_type: (oppData.routing_type ?? "external") as string,
    custom_fields: (oppData.custom_fields ?? []) as CustomField[],
    show_badges_in_submission: (oppData.show_badges_in_submission ?? true) as boolean,
  };

  // Get applications with artwork (but not artist profile — FK points to auth.users)
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
        .select("id, username, full_name, avatar_url, bio, medium, career_stage, exhibition_history, received_grants, is_patronage_supported")
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

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-6">
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

      {enrichedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No applications yet.</p>
      ) : view === "gallery" ? (
        /* Gallery view */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {enrichedApps
            .filter((a) => a.artwork)
            .map((app) => (
              <Link
                key={app.id}
                href={`/partner/dashboard/${opportunityId}?view=gallery&applicant=${app.id}`}
                className="border border-black overflow-hidden group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={app.artwork!.url}
                  alt={app.artwork!.caption ?? ""}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2 space-y-0.5">
                  <p className="text-xs font-semibold truncate">{app.artist?.full_name ?? app.artist?.username}</p>
                  {app.artwork!.caption && (
                    <p className="text-xs text-muted-foreground truncate">{app.artwork!.caption}</p>
                  )}
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 leading-none">{STATUS_LABELS[app.status] ?? app.status}</span>
                </div>
              </Link>
            ))}
        </div>
      ) : (
        /* Table view */
        <div className="border-t border-black">
          {enrichedApps.map((app) => (
            <Link
              key={app.id}
              href={`/partner/dashboard/${opportunityId}?applicant=${app.id}`}
              className="flex items-center gap-4 border-b border-black py-3 px-2 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {app.artist?.full_name ?? app.artist?.username ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">@{app.artist?.username}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(app.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}
              </span>
              <span className="text-xs bg-muted px-2 py-0.5 leading-none whitespace-nowrap">
                {STATUS_LABELS[app.status] ?? app.status}
              </span>
            </Link>
          ))}
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

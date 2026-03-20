import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplicationsManager } from "@/components/partner/ApplicationsManager";
import type { Metadata } from "next";
import type { CustomField } from "@/types/database";
import { isAdmin } from "@/lib/admin";

interface Props {
  params: Promise<{ opportunityId: string }>;
}

export const metadata: Metadata = { title: "Applications — Patronage" };

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

export default async function PartnerOpportunityPage({ params }: Props) {
  const { opportunityId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: oppData }, adminUser] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, organiser, type, slug, profile_id, routing_type, custom_fields, show_badges_in_submission, pipeline_config")
      .eq("id", opportunityId)
      .single(),
    isAdmin(),
  ]);

  if (!oppData || (oppData.profile_id !== user.id && !adminUser)) notFound();

  const opp = {
    id: oppData.id as string,
    title: oppData.title as string,
    organiser: oppData.organiser as string,
    type: oppData.type as string,
    slug: (oppData.slug ?? null) as string | null,
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

  // Fetch profiles
  const artistIds = [...new Set(apps.map((a) => a.artist_id))];
  const [{ data: profilesData }, emailResults] = await Promise.all([
    artistIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, medium, career_stage, country, cv_url, exhibition_history, received_grants, is_patronage_supported")
          .in("id", artistIds)
      : { data: [] },
    artistIds.length > 0
      ? (async () => {
          const admin = createAdminClient();
          const results = await Promise.all(
            artistIds.map((id) => admin.auth.admin.getUserById(id))
          );
          return results;
        })()
      : Promise.resolve([]),
  ]);

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profilesData ?? []) as unknown as ProfileRow[]) {
    profileMap.set(p.id, p);
  }

  const emailMap = new Map<string, string>();
  for (let i = 0; i < artistIds.length; i++) {
    const email = (emailResults as Array<{ data: { user: { email?: string } | null } }>)[i]?.data?.user?.email;
    if (email) emailMap.set(artistIds[i], email);
  }

  // Build enriched apps
  const enrichedApps = apps.map((app) => {
    const profile = profileMap.get(app.artist_id) ?? null;
    return {
      ...app,
      artist: profile
        ? {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            email: emailMap.get(app.artist_id) ?? null,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            medium: profile.medium,
            career_stage: profile.career_stage,
            country: profile.country,
            cv_url: profile.cv_url,
            exhibition_history: profile.exhibition_history as Array<{ type: "Solo" | "Group"; title: string; venue: string; location: string; year: number }> | null,
            received_grants: profile.received_grants,
            is_patronage_supported: profile.is_patronage_supported,
          }
        : null,
    };
  });

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12 space-y-6">
      {/* Header */}
      <div className="space-y-0.5">
        <Link href="/partner/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Partner Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{opp.title}</h1>
        <p className="text-sm text-muted-foreground">
          {enrichedApps.length} application{enrichedApps.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Client-side applications manager (filtering, CSV, gallery/table) */}
      <ApplicationsManager
        apps={enrichedApps}
        opp={opp}
        opportunityId={opportunityId}
      />
    </div>
  );
}

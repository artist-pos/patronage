import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomField, PipelineConfig } from "@/types/database";
import type { EnrichedApp } from "@/components/partner/types";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|tiff?)($|\?)/i;

interface AppRow {
  id: string;
  status: string;
  created_at: string;
  artwork_id: string | null;
  submitted_image_url: string | null;
  custom_answers: Record<string, string>;
  highres_asset_url: string | null;
  artist_id: string;
  documentation: Record<string, string> | null;
  invoice_requested_at: string | null;
  invoice_amount: number | null;
  invoice_paid_at: string | null;
  released_status?: string | null;
  creative_work_ids: string[] | null;
  work_descriptions: Record<string, string> | null;
  artwork: { id: string; url: string; caption: string | null; description: string | null } | null;
}

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
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
  identity_tags: string[] | null;
}

interface LogRow {
  id: string;
  application_id: string;
  old_status: string;
  new_status: string;
  changed_at: string;
  changer: { full_name: string | null; username: string } | { full_name: string | null; username: string }[] | null;
}

interface Options {
  /** Limit to these applications (for a reviewer's assigned queue). */
  appIds?: string[] | null;
  /** Include the status history (organiser view only). */
  withLog?: boolean;
  newestFirst?: boolean;
}

/**
 * Applications for one opportunity with everything a reviewer needs to read
 * them: the artist's profile, the works they picked, and the artwork or concept
 * image to use as a thumbnail. Applicant emails are deliberately not loaded here.
 */
export async function loadPipelineApplications(
  supabase: SupabaseClient,
  opportunityId: string,
  opp: { pipeline_config: PipelineConfig | null; custom_fields: CustomField[] | null },
  { appIds = null, withLog = false, newestFirst = true }: Options = {},
): Promise<EnrichedApp[]> {
  let query = supabase
    .from("opportunity_applications")
    .select("*, artwork:artwork_id(id, url, caption, description)")
    .eq("opportunity_id", opportunityId)
    .order("created_at", { ascending: !newestFirst });
  if (appIds) query = query.in("id", appIds.length > 0 ? appIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: appData } = await query;
  const apps = (appData ?? []) as unknown as AppRow[];

  const artistIds = [...new Set(apps.map((a) => a.artist_id))];
  const creativeWorkIds = [...new Set(apps.flatMap((a) => a.creative_work_ids ?? []))];
  const ids = apps.map((a) => a.id);

  const [profilesResult, logResult, worksResult, decisionResult] = await Promise.all([
    artistIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, medium, career_stage, city, country, cv_url, exhibition_history, received_grants, is_patronage_supported, year_of_birth, identity_tags")
          .in("id", artistIds)
      : Promise.resolve({ data: [] }),
    withLog && ids.length > 0
      ? supabase
          .from("application_status_log")
          .select("id, application_id, old_status, new_status, changed_at, changed_by, changer:changed_by(full_name, username)")
          .in("application_id", ids)
          .order("changed_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // creative_work_ids holds artworks.id values (the portfolio picker sources
    // from artworks); the column name is legacy.
    creativeWorkIds.length > 0
      ? supabase.from("artworks").select("id, title, caption, url, thumb_url, description").in("id", creativeWorkIds)
      : Promise.resolve({ data: [] }),
    // The working decision. If the table isn't there yet, fall back to the public status.
    ids.length > 0
      ? supabase.from("application_decisions").select("application_id, status").in("application_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const decisionsLoaded = !("error" in decisionResult && decisionResult.error);
  const decisionByApp = new Map(
    ((decisionResult.data ?? []) as Array<{ application_id: string; status: string }>).map((d) => [d.application_id, d.status]),
  );

  const profileMap = new Map<string, ProfileRow>();
  for (const p of (profilesResult.data ?? []) as unknown as ProfileRow[]) profileMap.set(p.id, p);

  const logByApp = new Map<string, NonNullable<EnrichedApp["status_log"]>>();
  for (const row of (logResult.data ?? []) as unknown as LogRow[]) {
    const who = Array.isArray(row.changer) ? row.changer[0] : row.changer;
    const list = logByApp.get(row.application_id) ?? [];
    list.push({
      id: row.id,
      old_status: row.old_status,
      new_status: row.new_status,
      changed_at: row.changed_at,
      changed_by_name: who?.full_name ?? who?.username ?? null,
    });
    logByApp.set(row.application_id, list);
  }

  type WorkRow = { id: string; title: string | null; caption: string | null; url: string; thumb_url: string | null; description: string | null };
  const workMap = new Map<string, WorkRow>();
  for (const w of (worksResult.data ?? []) as unknown as WorkRow[]) workMap.set(w.id, w);

  // The artist's actual submission (e.g. a concept sketch) beats a portfolio pick as a thumbnail.
  const fileQuestionIds = new Set([
    ...(opp.pipeline_config?.questions ?? []).filter((q) => q.type === "file_upload").map((q) => q.id),
    ...(opp.custom_fields ?? []).filter((f) => f.inputType === "file").map((f) => f.id),
  ]);
  function conceptImageFor(answers: Record<string, string>): string | null {
    for (const qId of fileQuestionIds) {
      const raw = answers?.[qId];
      if (!raw) continue;
      let urls: string[];
      try { const parsed = JSON.parse(raw); urls = Array.isArray(parsed) ? parsed : [raw]; }
      catch { urls = [raw]; }
      const image = urls.find((u) => IMAGE_RE.test(u));
      if (image) return image;
    }
    return null;
  }

  return apps.map((app) => {
    const profile = profileMap.get(app.artist_id) ?? null;
    return {
      ...app,
      // The organiser sees the working decision; `released_status` is what the artist sees.
      status: decisionsLoaded ? decisionByApp.get(app.id) ?? "pending" : app.status,
      released_status: app.status,
      concept_image_url: conceptImageFor(app.custom_answers),
      status_log: logByApp.get(app.id) ?? [],
      work_descriptions: app.work_descriptions ?? {},
      creative_works: (app.creative_work_ids ?? [])
        .map((id) => workMap.get(id))
        .filter((w): w is WorkRow => !!w),
      artist: profile
        ? {
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            medium: profile.medium,
            career_stage: profile.career_stage,
            city: profile.city,
            country: profile.country,
            cv_url: profile.cv_url,
            exhibition_history: profile.exhibition_history,
            received_grants: profile.received_grants,
            is_patronage_supported: profile.is_patronage_supported,
            year_of_birth: profile.year_of_birth,
            identity_tags: profile.identity_tags ?? [],
          }
        : null,
    };
  });
}

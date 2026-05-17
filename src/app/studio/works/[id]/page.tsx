import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
import { WorkPageClient } from "./WorkPageClient";
import { listDocPhotosWithUrls } from "@/lib/artwork-documentation";
import type { DocPhotoType } from "@/lib/artwork-documentation";
import { listPriorHistory } from "@/lib/artwork-prior-history";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Work — Studio — Patronage" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkEditorPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/studio");
  }

  const { data: work } = await supabase
    .from("artworks")
    .select("id, url, caption, title, year, medium, dimensions, description, content_type, is_featured, hide_from_archive, is_available, acquisition_mode, certificate_note, current_owner_id, creator_id, ledger_id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!work) notFound();

  const admin = createAdminClient();

  const [
    editions,
    { data: claims },
    { data: ledgerEntries },
    docPhotos,
    priorHistory,
    linkedProjectResult,
  ] = await Promise.all([
    supabase
      .from("editions")
      .select("*")
      .eq("work_id", work.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(r => r.data ?? []),
    admin
      .from("pending_ownership_claims")
      .select("id, claimer_name, claimer_email, claimed_at")
      .eq("artwork_id", id)
      .eq("status", "pending")
      .order("claimed_at", { ascending: false }),
    admin
      .from("artwork_provenance_ledger")
      .select("id, entry_type, transfer_method, transferred_at, to_owner_id")
      .eq("artwork_id", id)
      .order("transferred_at", { ascending: true }),
    listDocPhotosWithUrls(id),
    listPriorHistory(id),
    supabase
      .from("projects")
      .select("id, title")
      .eq("artwork_id", id)
      .eq("artist_id", user.id)
      .maybeSingle(),
  ]);

  const linkedProject = linkedProjectResult.data ?? null;

  // Resolve display names for ledger owners
  const ownerIds = [...new Set((ledgerEntries ?? []).map(e => e.to_owner_id))];
  const ownerNames: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: ownerProfiles } = await admin
      .from("profiles")
      .select("id, full_name, username")
      .in("id", ownerIds);
    for (const p of ownerProfiles ?? []) {
      ownerNames[p.id] = p.full_name ?? p.username;
    }
  }

  // Fetch linkable projects only if no project is already linked
  const [unlinkableProjectsResult, linkedProjectUpdates] = await Promise.all([
    !linkedProject
      ? supabase
          .from("projects")
          .select("id, title, project_updates(count)")
          .eq("artist_id", user.id)
          .is("artwork_id", null)
          .order("created_at", { ascending: false })
      : Promise.resolve(null),
    linkedProject
      ? supabase
          .from("project_updates")
          .select("id, content_type, image_url, caption, text_content, created_at")
          .eq("project_id", linkedProject.id)
          .order("created_at", { ascending: true })
          .then(r => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const unlinkableProjects = (unlinkableProjectsResult?.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    update_count: Array.isArray(p.project_updates)
      ? p.project_updates.length
      : (p.project_updates as { count: number } | null)?.count ?? 0,
  }));

  const displayTitle = work.title ?? work.caption ?? "Untitled";

  return (
    <StudioPageShell username={profile.username ?? ""} activeSection="works">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <Link href="/studio?section=works" className="hover:text-foreground transition-colors">
          Works
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate">{displayTitle}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-10">
        {work.url && (
          <img
            src={work.url}
            alt={displayTitle}
            className="w-16 h-16 object-cover shrink-0 bg-muted"
          />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">{displayTitle}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {[work.medium, work.year, work.dimensions].filter(Boolean).join(" · ")}
          </p>
          {work.ledger_id && (
            <Link
              href={`/provenance/${work.ledger_id}`}
              className="inline-flex items-center gap-1 mt-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {work.ledger_id}
            </Link>
          )}
        </div>
      </div>

      <WorkPageClient
        profileId={user.id}
        work={{
          id: work.id,
          url: work.url ?? "",
          caption: work.caption,
          title: work.title ?? null,
          year: work.year ?? null,
          medium: work.medium ?? null,
          dimensions: work.dimensions ?? null,
          description: work.description ?? null,
          content_type: work.content_type ?? "image",
          is_featured: work.is_featured ?? false,
          hide_from_archive: work.hide_from_archive ?? false,
          is_available: work.is_available ?? false,
          acquisition_mode: ((work.acquisition_mode as string | null) ?? "enquire_first") as "buy_now" | "make_offer" | "enquire_first",
          certificate_note: work.certificate_note ?? null,
          current_owner_id: work.current_owner_id ?? user.id,
          creator_id: work.creator_id ?? user.id,
          ledger_id: work.ledger_id ?? null,
        }}
        editions={editions}
        pendingClaims={(claims ?? []).map(c => ({
          id: c.id,
          claimer_name: c.claimer_name ?? "",
          claimer_email: c.claimer_email,
          claimed_at: c.claimed_at,
        }))}
        ledgerEntries={(ledgerEntries ?? []).map(e => ({
          id: e.id,
          entry_type: e.entry_type,
          transfer_method: e.transfer_method ?? "",
          transferred_at: e.transferred_at,
          owner_name: ownerNames[e.to_owner_id] ?? "Unknown",
        }))}
        docPhotos={docPhotos.map(p => ({
          id: p.id,
          type: p.type as DocPhotoType,
          caption: p.caption,
          signedUrl: p.signedUrl,
        }))}
        priorHistory={priorHistory}
        linkedProject={linkedProject}
        linkedProjectUpdates={linkedProjectUpdates}
        unlinkableProjects={unlinkableProjects}
      />
    </StudioPageShell>
  );
}

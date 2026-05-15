import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { WorkPageClient } from "./WorkPageClient";
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/studio");
  }

  const { data: work } = await supabase
    .from("portfolio_images")
    .select("id, url, caption, title, year, medium, dimensions, description, content_type, is_featured, hide_from_archive, linked_artwork_id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!work) notFound();

  const editions = await supabase
    .from("editions")
    .select("*")
    .eq("work_id", work.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .then(r => r.data ?? []);

  const displayTitle = work.title ?? work.caption ?? "Untitled";

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10">
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
          linked_artwork_id: work.linked_artwork_id ?? null,
        }}
        editions={editions}
      />
    </div>
  );
}

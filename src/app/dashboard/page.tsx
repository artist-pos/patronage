import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { ApplicationsTab } from "@/components/dashboard/ApplicationsTab";
import { ProvenanceBanner } from "@/components/dashboard/ProvenanceBanner";
import { ManageNotesList } from "@/components/profile/ManageNotesList";
import { getMyWrittenNotes } from "@/lib/notes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Patronage",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const TABS = ["closing", "saved", "applied", "applications", "expired", "notes"] as const;
type Tab = typeof TABS[number];


export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const rawTab = params.tab ?? "closing";
  const activeTab: Tab = (TABS as readonly string[]).includes(rawTab) ? rawTab as Tab : "closing";

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isPatron = userProfile?.role === "patron" || userProfile?.role === "partner";

  // Core opportunity data — always needed
  const [saved, applicationsData, draftsData, provenanceData] = await Promise.all([
    getSavedOpportunities(),
    supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(id, slug, title, organiser, type, deadline, profile_id, profiles:profile_id(full_name, username))")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("opportunity_application_drafts")
      .select("*, opportunity:opportunities(*)")
      .eq("artist_id", user.id)
      .order("updated_at", { ascending: false }),
    isPatron
      ? supabase
          .from("provenance_links")
          .select("id, artwork_id, artist_id, artworks(url, caption), artist_profile:artist_id(username, full_name)")
          .eq("patron_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Notes tab data
  const notes = activeTab === "notes" ? await getMyWrittenNotes(user.id) : null;

  const { closingSoon, saved: savedList, applied, expired } = categorizeSaved(saved);
  const applications = applicationsData.data ?? [];
  const drafts = draftsData.data ?? [];

  const provenanceLinks = (provenanceData.data ?? []).map((row: any) => ({
    id: row.id,
    artwork_id: row.artwork_id,
    artwork_url: row.artworks?.url ?? "",
    artwork_caption: row.artworks?.caption ?? null,
    artist_username: row.artist_profile?.username ?? "",
    artist_name: row.artist_profile?.full_name ?? null,
  }));

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "closing", label: "Closing Soon", count: closingSoon.length },
    { id: "saved", label: "Saved", count: savedList.length },
    { id: "applied", label: "Applied", count: applied.length },
    { id: "applications", label: "Applications", count: applications.length + drafts.length },
    { id: "expired", label: "Expired", count: expired.length },
    { id: "notes", label: "Notes" },
  ];

  const listMap: Record<string, typeof saved> = {
    closing: closingSoon,
    saved: savedList,
    applied,
    expired,
  };
  const currentList = listMap[activeTab] ?? [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Opportunities, analytics, and notes in one place.
        </p>
      </div>

      {provenanceLinks.length > 0 && <ProvenanceBanner links={provenanceLinks} />}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-black overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/dashboard?tab=${tab.id}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-black font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 leading-none">
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Applications tab ── */}
      {activeTab === "applications" && (
        <ApplicationsTab
          initialApplications={applications as Parameters<typeof ApplicationsTab>[0]["initialApplications"]}
          userId={user.id}
          initialDrafts={drafts as Parameters<typeof ApplicationsTab>[0]["initialDrafts"]}
        />
      )}

      {/* ── Notes tab ── */}
      {activeTab === "notes" && notes !== null && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Notes you've left on studio updates across the platform.
          </p>
          <ManageNotesList initialNotes={notes} />
        </div>
      )}

      {/* ── Opportunity list tabs ── */}
      {!["applications", "notes"].includes(activeTab) && (
        currentList.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {activeTab === "closing"
                ? "No saved opportunities closing in the next 14 days."
                : activeTab === "saved"
                ? "No saved opportunities. When you find something worth coming back to, save it and it'll appear here."
                : activeTab === "applied"
                ? "No applications yet. When you apply through Patronage, you can track their status here."
                : "No expired opportunities."}
            </p>
            {(activeTab === "closing" || activeTab === "saved") && (
              <Link href="/opportunities" className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors">
                Browse Opportunities →
              </Link>
            )}
          </div>
        ) : (
          <div className="border-t border-black">
            {currentList.map((item) => (
              <OpportunityCard key={item.id} opp={item.opportunity} view="list" />
            ))}
          </div>
        )
      )}
    </div>
  );
}

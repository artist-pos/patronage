import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { ApplicationsTab } from "@/components/dashboard/ApplicationsTab";
import { ProvenanceBanner } from "@/components/dashboard/ProvenanceBanner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Opportunities — Patronage",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;
  const activeTab = params.tab ?? "closing";

  // Fetch user role to show provenance links for patrons
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isPatron = userProfile?.role === "patron" || userProfile?.role === "partner";

  const [saved, applicationsData, provenanceData] = await Promise.all([
    getSavedOpportunities(),
    supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(id, title, organiser, type, deadline, profile_id, profiles:profile_id(full_name, username))")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    // Pending provenance links for patrons/partners
    isPatron
      ? supabase
          .from("provenance_links")
          .select("id, artwork_id, artist_id, artworks(url, caption), artist_profile:artist_id(username, full_name)")
          .eq("patron_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const { closingSoon, saved: savedList, applied, expired } = categorizeSaved(saved);
  const applications = applicationsData.data ?? [];

  // Shape provenance links for the banner
  const provenanceLinks = (provenanceData.data ?? []).map((row: any) => ({
    id: row.id,
    artwork_id: row.artwork_id,
    artwork_url: row.artworks?.url ?? "",
    artwork_caption: row.artworks?.caption ?? null,
    artist_username: row.artist_profile?.username ?? "",
    artist_name: row.artist_profile?.full_name ?? null,
  }));

  const tabs = [
    { id: "closing", label: "Closing Soon", count: closingSoon.length },
    { id: "saved", label: "Saved", count: savedList.length },
    { id: "applied", label: "Applied", count: applied.length },
    { id: "applications", label: "Applications", count: applications.length },
    { id: "expired", label: "Expired", count: expired.length },
  ];

  const listMap: Record<string, typeof saved> = {
    closing: closingSoon,
    saved: savedList,
    applied,
    expired,
  };

  const currentList = listMap[activeTab] ?? [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Opportunities</h1>
        <p className="text-sm text-muted-foreground">Track and manage the opportunities you&apos;ve saved.</p>
      </div>

      {/* Provenance verification banner — patrons only */}
      {provenanceLinks.length > 0 && (
        <ProvenanceBanner links={provenanceLinks} />
      )}

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
            {tab.count > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 leading-none">
                {tab.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Applications tab — has realtime client component */}
      {activeTab === "applications" ? (
        <ApplicationsTab
          initialApplications={applications as Parameters<typeof ApplicationsTab>[0]["initialApplications"]}
          userId={user.id}
        />
      ) : currentList.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {activeTab === "closing"
              ? "No saved opportunities closing in the next 14 days."
              : activeTab === "saved"
              ? "You haven't saved any opportunities yet."
              : activeTab === "applied"
              ? "No opportunities marked as applied."
              : "No expired opportunities."}
          </p>
          {(activeTab === "closing" || activeTab === "saved") && (
            <Link
              href="/opportunities"
              className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
            >
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
      )}
    </div>
  );
}

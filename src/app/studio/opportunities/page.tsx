import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getSavedOpportunities, categorizeSaved } from "@/lib/saved-opportunities";
import { OpportunitiesFilterClient } from "@/components/studio/OpportunitiesFilterClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Opportunities — Studio" };

interface PageProps {
  searchParams: Promise<{ of?: string }>;
}

export default async function StudioOpportunitiesPage({ searchParams }: PageProps) {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const params = await searchParams;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, gst_registered, gst_number")
    .eq("id", user.id)
    .single();

  const OPP_FILTERS = ["all", "saved", "closing", "applied", "expired"] as const;
  type OppFilter = typeof OPP_FILTERS[number];
  const activeOppFilter: OppFilter = (OPP_FILTERS as readonly string[]).includes(params.of ?? "")
    ? (params.of as OppFilter)
    : "all";

  const [savedData, applicationsData] = await Promise.all([
    getSavedOpportunities(),
    supabase
      .from("opportunity_applications")
      .select("*, opportunity:opportunities(id, slug, title, organiser, type, deadline, profile_id, pipeline_config, profiles:profile_id(full_name, username))")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const categorised = categorizeSaved(savedData);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Opportunities</h2>
        <p className="text-sm text-muted-foreground">
          Saved grants, residencies, and open calls — plus your active applications.
        </p>
      </div>
      <OpportunitiesFilterClient
        initialFilter={activeOppFilter}
        userId={user.id}
        savedList={categorised.saved}
        closingSoon={categorised.closingSoon}
        applied={categorised.applied}
        expired={categorised.expired}
        applications={applicationsData.data ?? []}
        artistName={profileRow?.full_name ?? null}
        artistGstRegistered={profileRow?.gst_registered ?? false}
        artistGstNumber={profileRow?.gst_number ?? null}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partner Dashboard — Patronage",
};

export default async function PartnerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = profile?.role;

  if (userRole !== "partner" && userRole !== "admin" && userRole !== "owner") {
    redirect("/");
  }

  const isAdminUser = userRole === "admin" || userRole === "owner";

  // For non-admin users: also fetch opportunity IDs they are a collaborator on
  let collaboratorOppIds: string[] = [];
  if (!isAdminUser) {
    const { data: collabRows } = await supabase
      .from("opportunity_collaborators")
      .select("opportunity_id")
      .eq("profile_id", user.id);
    collaboratorOppIds = (collabRows ?? []).map((r: { opportunity_id: string }) => r.opportunity_id);
  }

  // Build queries — admins see everything; others see own + collaborator opportunities
  let [{ data: opportunities }, { data: submissions }, { data: allListings }]: [
    { data: unknown[] | null },
    { data: unknown[] | null },
    { data: unknown[] | null },
  ] = [{ data: [] }, { data: [] }, { data: [] }];

  if (isAdminUser) {
    [{ data: opportunities }, { data: submissions }, { data: allListings }] = await Promise.all([
      supabase
        .from("opportunities")
        .select("id, title, type, deadline, is_active, routing_type, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
        .eq("routing_type", "pipeline")
        .order("created_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, title, type, deadline, status, routing_type, created_at")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, title, type, status, is_active, routing_type, deadline, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
        .order("created_at", { ascending: false }),
    ]);
  } else {
    // Own opps + collaborator opps
    const ownOrCollab = collaboratorOppIds.length > 0
      ? `profile_id.eq.${user.id},id.in.(${collaboratorOppIds.join(",")})`
      : undefined;

    [{ data: opportunities }, { data: submissions }, { data: allListings }] = await Promise.all([
      ownOrCollab
        ? supabase
            .from("opportunities")
            .select("id, title, type, deadline, is_active, routing_type, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
            .eq("routing_type", "pipeline")
            .or(ownOrCollab)
            .order("created_at", { ascending: false })
        : supabase
            .from("opportunities")
            .select("id, title, type, deadline, is_active, routing_type, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
            .eq("routing_type", "pipeline")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false }),
      supabase
        .from("opportunities")
        .select("id, title, type, deadline, status, routing_type, created_at")
        .eq("profile_id", user.id)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false }),
      ownOrCollab
        ? supabase
            .from("opportunities")
            .select("id, title, type, status, is_active, routing_type, deadline, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
            .or(ownOrCollab)
            .order("created_at", { ascending: false })
        : supabase
            .from("opportunities")
            .select("id, title, type, status, is_active, routing_type, deadline, profile_id, organiser, profiles!opportunities_profile_id_fkey(full_name, username)")
            .eq("profile_id", user.id)
            .order("created_at", { ascending: false }),
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oppIds = (opportunities ?? []).map((o: any) => o.id);

  // Get application counts per opportunity
  const { data: appCounts } = oppIds.length > 0
    ? await supabase
        .from("opportunity_applications")
        .select("opportunity_id, status")
        .in("opportunity_id", oppIds)
    : { data: [] };

  const countMap = new Map<string, { total: number; pending: number; shortlisted: number; selected: number }>();
  for (const app of appCounts ?? []) {
    const a = app as { opportunity_id: string; status: string };
    if (!countMap.has(a.opportunity_id)) {
      countMap.set(a.opportunity_id, { total: 0, pending: 0, shortlisted: 0, selected: 0 });
    }
    const entry = countMap.get(a.opportunity_id)!;
    entry.total++;
    if (a.status === "pending") entry.pending++;
    if (a.status === "shortlisted") entry.shortlisted++;
    if (a.status === "selected" || a.status === "approved_pending_assets" || a.status === "production_ready") entry.selected++;
  }

  const hasAnything = (opportunities && opportunities.length > 0) || (submissions && submissions.length > 0) || (allListings && allListings.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Partner Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isAdminUser
              ? "Admin view — all partner pipelines across the platform."
              : "Manage your pipeline opportunities and track applications."}
          </p>
        </div>
        {!isAdminUser && (
          <Link
            href="/partners"
            className="shrink-0 bg-black text-white text-sm px-4 py-2 hover:bg-black/80 transition-colors"
          >
            + Submit opportunity
          </Link>
        )}
      </div>

      {!hasAnything ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No opportunities yet.</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Live pipeline opportunities ────────────────────────────── */}
          {opportunities && opportunities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live Pipelines{isAdminUser ? ` (${opportunities.length} across all partners)` : ""}</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(opportunities as any[]).map((opp) => {
                const counts = countMap.get(opp.id) ?? { total: 0, pending: 0, shortlisted: 0, selected: 0 };
                const isCollaboratorOpp = !isAdminUser && collaboratorOppIds.includes(opp.id) && opp.profile_id !== user.id;
                const partnerName = isAdminUser
                  ? (opp.profiles as { full_name: string | null; username: string } | null)?.full_name
                    ?? (opp.profiles as { full_name: string | null; username: string } | null)?.username
                    ?? opp.organiser
                    ?? null
                  : null;
                return (
                  <Link
                    key={opp.id}
                    href={`/partner/dashboard/${opp.id}`}
                    className="flex items-center justify-between border border-black p-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-sm">{opp.title}</p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{opp.type}</span>
                        {opp.deadline && (
                          <span>Deadline {new Date(opp.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</span>
                        )}
                        {partnerName && (
                          <span className="text-stone-500">Partner: {partnerName}</span>
                        )}
                        {isCollaboratorOpp && (
                          <span className="bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 text-[10px] leading-none">Collaborator</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <span className="text-muted-foreground">{counts.total} applicant{counts.total !== 1 ? "s" : ""}</span>
                      {counts.pending > 0 && (
                        <span className="bg-muted px-2 py-0.5 leading-none">{counts.pending} new</span>
                      )}
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* ── Your Listings ───────────────────────────────────────────── */}
          {allListings && allListings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {isAdminUser ? "All Listings" : "Your Listings"}
              </p>
              <div className="border border-black overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/20 bg-muted/30">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Title</th>
                      {isAdminUser && <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Partner</th>}
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Deadline</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(allListings as any[]).map((listing) => {
                      const statusColour =
                        listing.status === "published"
                          ? "text-green-700"
                          : listing.status === "draft" || listing.status === "draft_unclaimed"
                          ? "text-yellow-700"
                          : "text-muted-foreground";
                      const statusLabel =
                        listing.status === "draft_unclaimed" ? "draft" : listing.status;
                      const isPipeline = listing.routing_type === "pipeline" && listing.status === "published";
                      const isCollaboratorListing = !isAdminUser && collaboratorOppIds.includes(listing.id) && listing.profile_id !== user.id;
                      const partnerName = isAdminUser
                        ? (listing.profiles as { full_name: string | null; username: string } | null)?.full_name
                          ?? (listing.profiles as { full_name: string | null; username: string } | null)?.username
                          ?? listing.organiser
                          ?? "—"
                        : null;
                      return (
                        <tr key={listing.id} className="border-b border-black/10 last:border-0">
                          <td className="py-2.5 px-3 font-medium">{listing.title}</td>
                          {isAdminUser && (
                            <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">{partnerName}</td>
                          )}
                          <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">{listing.type}</td>
                          <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                            {listing.deadline
                              ? new Date(listing.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
                              : "Open"}
                          </td>
                          <td className={`py-2.5 px-3 ${statusColour}`}>
                            <span>{statusLabel}</span>
                            {isCollaboratorListing && (
                              <span className="ml-2 bg-stone-100 text-stone-600 rounded-full px-2 py-0.5 text-[10px] leading-none">Collaborator</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {isPipeline && (
                                <Link
                                  href={`/partner/dashboard/${listing.id}`}
                                  className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Applications →
                                </Link>
                              )}
                              {!isCollaboratorListing && (
                                <Link
                                  href={`/partner/opportunities/${listing.id}/edit`}
                                  className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Edit →
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Pending submissions awaiting review ────────────────────── */}
          {submissions && submissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Awaiting Review</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(submissions as any[]).map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between border border-black/40 p-4"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-semibold text-sm text-muted-foreground">{sub.title}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{sub.type}</span>
                      <span>Submitted {new Date(sub.created_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 leading-none border ${
                    sub.status === "rejected"
                      ? "border-destructive text-destructive"
                      : "border-black/30 text-muted-foreground"
                  }`}>
                    {sub.status === "rejected" ? "Rejected" : "Under review"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

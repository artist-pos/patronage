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

  if (profile?.role !== "partner" && profile?.role !== "admin" && profile?.role !== "owner") {
    redirect("/");
  }

  const [{ data: opportunities }, { data: submissions }, { data: allListings }] = await Promise.all([
    // Live pipeline opportunities owned by this partner
    supabase
      .from("opportunities")
      .select("id, title, type, deadline, is_active, routing_type")
      .eq("profile_id", user.id)
      .eq("routing_type", "pipeline")
      .order("created_at", { ascending: false }),

    // Pending / rejected submissions from this partner (not yet approved)
    supabase
      .from("opportunity_submissions")
      .select("id, title, type, deadline, status, routing_type, created_at")
      .eq("profile_id", user.id)
      .neq("status", "approved")
      .order("created_at", { ascending: false }),

    // All claimed listings owned by this partner (any routing type)
    supabase
      .from("opportunities")
      .select("id, title, type, status, is_active, routing_type, deadline")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const oppIds = (opportunities ?? []).map((o: { id: string }) => o.id);

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
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Partner Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your pipeline opportunities and track applications.</p>
      </div>

      {!hasAnything ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No opportunities yet.</p>
          <Link
            href="/partners"
            className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
          >
            Post an Opportunity →
          </Link>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Your Listings ───────────────────────────────────────────── */}
          {allListings && allListings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your Listings</p>
              <div className="border border-black overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/20 bg-muted/30">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Title</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Type</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Deadline</th>
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      <th className="py-2 px-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {allListings.map((listing: { id: string; title: string; type: string; status: string; deadline: string | null }) => {
                      const statusColour =
                        listing.status === "published"
                          ? "text-green-700"
                          : listing.status === "draft" || listing.status === "draft_unclaimed"
                          ? "text-yellow-700"
                          : "text-muted-foreground";
                      const statusLabel =
                        listing.status === "draft_unclaimed" ? "draft" : listing.status;
                      return (
                        <tr key={listing.id} className="border-b border-black/10 last:border-0">
                          <td className="py-2.5 px-3 font-medium">{listing.title}</td>
                          <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">{listing.type}</td>
                          <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell">
                            {listing.deadline
                              ? new Date(listing.deadline + "T00:00:00").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
                              : "Open"}
                          </td>
                          <td className={`py-2.5 px-3 ${statusColour}`}>{statusLabel}</td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href={`/partner/opportunities/${listing.id}/edit`}
                              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Edit →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Live pipeline opportunities ────────────────────────────── */}
          {opportunities && opportunities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live</p>
              {opportunities.map((opp: { id: string; title: string; type: string; deadline: string | null; is_active: boolean }) => {
                const counts = countMap.get(opp.id) ?? { total: 0, pending: 0, shortlisted: 0, selected: 0 };
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

          {/* ── Pending submissions awaiting review ────────────────────── */}
          {submissions && submissions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Awaiting Review</p>
              {submissions.map((sub: { id: string; title: string; type: string; deadline: string | null; status: string; created_at: string }) => (
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

          <Link
            href="/partners"
            className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Submit another opportunity
          </Link>
        </div>
      )}
    </div>
  );
}

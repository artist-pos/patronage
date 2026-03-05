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

  if (profile?.role !== "partner" && profile?.role !== "admin") {
    redirect("/");
  }

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("id, title, type, deadline, is_active, routing_type")
    .eq("profile_id", user.id)
    .eq("routing_type", "pipeline")
    .order("created_at", { ascending: false });

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

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Partner Dashboard</h1>
        <p className="text-sm text-muted-foreground">Review applications for your pipeline opportunities.</p>
      </div>

      {!opportunities || opportunities.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No pipeline opportunities yet.</p>
          <Link
            href="/partners"
            className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
          >
            Post an Opportunity →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
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
    </div>
  );
}

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { SubmissionsBoard } from "./SubmissionsBoard";
import { outreachMissingFor } from "@/lib/claim-outreach";
import type { Opportunity } from "@/types/database";

export const metadata = { title: "Submissions — Admin" };

export default async function AdminSubmissionsPage() {
  if (!(await isAdmin())) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunities")
    .select("*")
    .in("status", ["pending", "rejected"])
    // Scraped listings are reviewed in the Scraper Queue, not here.
    .neq("origin", "scraper")
    .order("created_at", { ascending: false });

  const submissions = (data ?? []) as Opportunity[];

  // For open calls: how many earlier ones has this organisation run?
  const priorRounds: Record<string, number> = {};
  const owners = [...new Set(submissions.filter((s) => s.routing_type === "pipeline" && s.profile_id).map((s) => s.profile_id as string))];
  if (owners.length > 0) {
    const { data: earlier } = await supabase
      .from("opportunities")
      .select("id, profile_id")
      .in("profile_id", owners)
      .eq("routing_type", "pipeline")
      .not("pipeline_paid_at", "is", null);
    for (const row of earlier ?? []) {
      priorRounds[row.profile_id as string] = (priorRounds[row.profile_id as string] ?? 0) + 1;
    }
  }
  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending").slice(0, 30);
  const needDetails = pending.filter((s) => outreachMissingFor(s).length > 0).length;
  const tips = pending.filter((s) => s.origin === "tip").length;

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Review</p>
          <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Listings sent in by organisations, community tips, and listings added by an admin. Tips and admin listings
            need claim outreach details before they go live, so the claim email has someone to write to.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Waiting" value={pending.length} />
          <Stat label="Tips" value={tips} />
          <Stat label="Need outreach details" value={needDetails} highlight={needDetails > 0} />
          <Stat label="Recently rejected" value={reviewed.length} />
        </div>
      </header>

      <section className="space-y-4">
        <SubmissionsBoard pending={pending} priorRounds={priorRounds} />
      </section>

      {reviewed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Recently rejected</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {reviewed.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sub.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub.organiser}</p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] text-stone-600">
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${highlight ? "border-amber-300 bg-amber-50/60" : "border-border bg-background"}`}>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

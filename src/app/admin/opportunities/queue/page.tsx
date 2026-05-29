export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import { QueueControls } from "./QueueControls";
import type { Opportunity } from "@/types/database";

export const metadata = { title: "Scraper Queue — Admin — Patronage" };

async function getQueueOpportunities(status: string): Promise<Opportunity[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("opportunities")
    .select("*")
    .eq("status", status)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Opportunity[];
}

export default async function QueuePage() {
  const [pending, rejected] = await Promise.all([
    getQueueOpportunities("pending"),
    getQueueOpportunities("rejected"),
  ]);

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Scraper Queue</h1>
          <p className="text-xs text-muted-foreground">
            Review opportunities found by the scraper before they go live.
          </p>
        </div>
        <QueueControls opps={pending} tab="pending" />
      </div>

      {rejected.length > 0 && (
        <div className="space-y-4 border-t border-border pt-8">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight">Rejected ({rejected.length})</h2>
            <p className="text-xs text-muted-foreground">
              Accidentally rejected? Use Restore to re-publish.
            </p>
          </div>
          <QueueControls opps={rejected} tab="rejected" />
        </div>
      )}
    </div>
  );
}

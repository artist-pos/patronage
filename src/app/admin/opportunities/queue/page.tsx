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
    .order("created_at", { ascending: false });
  return (data ?? []) as Opportunity[];
}

export default async function QueuePage() {
  const opps = await getQueueOpportunities("pending");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Scraper Queue</h1>
        <p className="text-xs text-muted-foreground">
          Review opportunities found by the scraper before they go live. Rejected opportunities are permanently deleted.
        </p>
      </div>

      <QueueControls opps={opps} tab="pending" />
    </div>
  );
}

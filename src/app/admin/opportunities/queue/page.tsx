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

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function QueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.status === "rejected" ? "rejected" : "pending";

  const opps = await getQueueOpportunities(tab);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Scraper Queue</h1>
        <p className="text-xs text-muted-foreground">
          Review opportunities found by the scraper before they go live.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border pb-2 text-sm">
        <a
          href="/admin/opportunities/queue"
          className={tab === "pending" ? "font-semibold" : "text-muted-foreground hover:text-foreground"}
        >
          Pending
        </a>
        <a
          href="/admin/opportunities/queue?status=rejected"
          className={tab === "rejected" ? "font-semibold" : "text-muted-foreground hover:text-foreground"}
        >
          Rejected
        </a>
      </div>

      <QueueControls opps={opps} tab={tab} />
    </div>
  );
}

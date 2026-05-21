export const dynamic = "force-dynamic";
import { getAllOpportunities } from "@/lib/admin";
import { OpportunityTable } from "@/components/admin/OpportunityTable";
import { ClaimFunnelMetrics } from "@/components/admin/ClaimFunnelMetrics";
import type { Opportunity } from "@/types/database";

export const metadata = { title: "Opportunities — Admin — Patronage" };

function computeFunnel(opps: Opportunity[]) {
  const sent = opps.filter(o => o.claim_invite_sent_at).length;
  const opened = opps.filter(o => o.claim_link_opened_at).length;
  const claimed = opps.filter(o => o.profile_id && o.claim_token).length;
  const pipelineActivated = opps.filter(o => o.profile_id && o.routing_type === "pipeline").length;
  return { sent, opened, claimed, pipelineActivated };
}

export default async function AdminOpportunitiesPage() {
  const opps = await getAllOpportunities();
  const active = opps.filter((o) => o.is_active).length;
  const funnel = computeFunnel(opps);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-xs text-muted-foreground">
          {opps.length} total · {active} active · Deactivate to hide from public
          without deleting.
        </p>
      </div>
      <ClaimFunnelMetrics data={funnel} />
      <OpportunityTable opps={opps} />
    </div>
  );
}

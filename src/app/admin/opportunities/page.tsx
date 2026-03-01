import { getAllOpportunities } from "@/lib/admin";
import { OpportunityTable } from "@/components/admin/OpportunityTable";

export const metadata = { title: "Opportunities — Admin — Patronage" };

export default async function AdminOpportunitiesPage() {
  const opps = await getAllOpportunities();
  const active = opps.filter((o) => o.is_active).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-xs text-muted-foreground">
          {opps.length} total · {active} active · Deactivate to hide from public
          without deleting.
        </p>
      </div>
      <OpportunityTable opps={opps} />
    </div>
  );
}

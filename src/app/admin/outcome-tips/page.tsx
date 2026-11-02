export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { TipReviewButtons } from "@/components/admin/TipReviewButtons";

export const metadata: Metadata = { title: "Outcome tips — Admin" };

interface Row {
  opportunity_id: string;
  user_id: string;
  applied: boolean;
  result: string | null;
  tip: string | null;
  tip_status: string;
  private_note: string | null;
  created_at: string;
}

const RESULT_LABEL: Record<string, string> = {
  selected: "selected",
  shortlisted: "shortlisted",
  unsuccessful: "unsuccessful",
  no_response: "never heard back",
};

/**
 * Tips from outcome reports wait here before they show (anonymously) on the
 * opportunity page. Private notes to Patronage show here too and never leave.
 */
export default async function AdminOutcomeTipsPage() {
  const admin = createAdminClient();
  const [{ data: pending }, { data: notes }] = await Promise.all([
    admin
      .from("opportunity_outcomes")
      .select("opportunity_id, user_id, applied, result, tip, tip_status, private_note, created_at")
      .not("tip", "is", null)
      .eq("tip_status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    admin
      .from("opportunity_outcomes")
      .select("opportunity_id, user_id, applied, result, tip, tip_status, private_note, created_at")
      .not("private_note", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const tips = (pending ?? []) as Row[];
  const privateNotes = (notes ?? []) as Row[];

  const oppIds = [...new Set([...tips, ...privateNotes].map((r) => r.opportunity_id))];
  const { data: opps } = oppIds.length
    ? await admin.from("opportunities").select("id, slug, title, organiser").in("id", oppIds)
    : { data: [] };
  const oppMap = new Map((opps ?? []).map((o) => [o.id, o]));

  const oppLine = (r: Row) => {
    const o = oppMap.get(r.opportunity_id);
    return o ? (
      <Link href={`/opportunities/${o.slug ?? o.id}`} className="underline underline-offset-2">
        {o.title} · {o.organiser}
      </Link>
    ) : (
      r.opportunity_id
    );
  };

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Tips waiting for review ({tips.length})</h1>
          <p className="text-sm text-muted-foreground">
            Approved tips show without a name, once the opportunity has 5+ reports. Hide anything that names people, is a
            complaint, or isn&rsquo;t useful to the next applicant.
          </p>
        </div>
        {tips.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {tips.map((r) => (
              <li key={`${r.opportunity_id}:${r.user_id}`} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0 max-w-[720px] space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {oppLine(r)} · {r.applied ? `applied, ${RESULT_LABEL[r.result ?? ""] ?? "no result"}` : "didn't apply"}
                  </p>
                  <p className="text-sm">{r.tip}</p>
                </div>
                <TipReviewButtons opportunityId={r.opportunity_id} userId={r.user_id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Private notes to Patronage</h2>
          <p className="text-sm text-muted-foreground">Never shown publicly. Latest 50.</p>
        </div>
        {privateNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {privateNotes.map((r) => (
              <li key={`${r.opportunity_id}:${r.user_id}`} className="space-y-1 py-4">
                <p className="text-xs text-muted-foreground">
                  {oppLine(r)} · {new Date(r.created_at).toLocaleDateString("en-NZ")}
                </p>
                <p className="whitespace-pre-wrap text-sm">{r.private_note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

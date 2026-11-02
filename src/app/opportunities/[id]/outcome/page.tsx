import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { OutcomeForm } from "@/components/opportunities/OutcomeForm";
import type { OutcomeInput } from "@/actions/outcomes";

export const metadata: Metadata = { title: "How did it go?", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OutcomeReportPage({ params }: Props) {
  const { id } = await params;
  const { supabase, user } = await getServerUser();
  if (!user) redirect(`/auth/login?redirect=/opportunities/${id}/outcome`);

  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, slug, title, organiser, deadline, is_active, status")
    .eq(UUID_RE.test(id) ? "id" : "slug", id)
    .maybeSingle();
  if (!opp || opp.status !== "published") notFound();

  const href = `/opportunities/${opp.slug ?? opp.id}`;
  const today = new Date().toISOString().slice(0, 10);
  const closed = (!!opp.deadline && opp.deadline < today) || !opp.is_active;

  const { data: existing } = await supabase
    .from("opportunity_outcomes")
    .select("applied, result, response_weeks, tip, private_note")
    .eq("opportunity_id", opp.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const initial: OutcomeInput | null = existing
    ? {
        applied: existing.applied,
        result: existing.result,
        responseWeeks: existing.response_weeks,
        tip: existing.tip ?? "",
        privateNote: existing.private_note ?? "",
      }
    : null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <div className="max-w-[560px]">
        <Link href={href} className="mb-6 inline-block font-mono text-xs text-muted-foreground hover:text-foreground">
          ← {opp.title}
        </Link>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">How did it go?</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {opp.organiser} · Two quick questions. Other artists see only totals, never who answered, and only once enough
          people have reported.
        </p>
        {closed ? (
          <OutcomeForm opportunityId={opp.id} opportunityHref={href} initial={initial} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This opportunity hasn&rsquo;t closed yet. Come back after the deadline to share how it went.
          </p>
        )}
      </div>
    </div>
  );
}

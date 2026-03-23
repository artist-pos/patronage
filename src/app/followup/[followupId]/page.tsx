import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FollowupForm } from "./FollowupForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Share Your Update — Patronage" };

interface Props {
  params: Promise<{ followupId: string }>;
}

export default async function FollowupPage({ params }: Props) {
  const { followupId } = await params;
  const admin = createAdminClient();

  const { data: followup } = await admin
    .from("artist_followups")
    .select("id, followup_type, completed_at, profile_id, opportunity_id")
    .eq("id", followupId)
    .single();

  if (!followup) notFound();

  // Fetch opportunity title and artist name for context
  const [{ data: opp }, { data: profile }] = await Promise.all([
    admin.from("opportunities").select("title, organiser").eq("id", followup.opportunity_id as string).single(),
    admin.from("profiles").select("full_name, username").eq("id", followup.profile_id as string).single(),
  ]);

  const artistName = (profile as { full_name?: string | null; username?: string } | null)?.full_name
    ?? (profile as { username?: string } | null)?.username
    ?? "Artist";
  const oppTitle = (opp as { title?: string } | null)?.title ?? "your selected opportunity";
  const isCompleted = !!(followup as { completed_at?: string | null }).completed_at;
  const followupType = (followup as { followup_type?: string }).followup_type ?? "6_month";
  const monthLabel = followupType === "12_month" ? "12" : "6";

  if (isCompleted) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Already submitted</h1>
        <p className="text-sm text-muted-foreground">
          Thank you — your follow-up for <strong>{oppTitle}</strong> has already been submitted. We appreciate you taking the time to share your update.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {monthLabel}-month follow-up
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Kia ora {artistName} — how have things been going?
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {monthLabel === "6" ? "Six" : "Twelve"} months ago you were selected for <strong>{oppTitle}</strong>. We&rsquo;d love to hear what&rsquo;s happened since.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your responses are used in anonymised, aggregate impact reporting only — unless you opt in to share a testimonial. This takes about 2 minutes.
        </p>
      </div>

      <FollowupForm followupId={followupId} />
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import { nzDatePlus } from "@/lib/deadline-reminders";
import { isShadowEmail } from "@/lib/shadow";
import { buildOutcomePromptEmail, type OutcomePromptItem } from "@/lib/outcome-prompts";

/** Prompt six weeks after the deadline; a week-long window catches missed runs. */
const PROMPT_AFTER_DAYS = 42;
const WINDOW_DAYS = 7;

interface ProfileRow {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  deadline_reminders: boolean | null;
  digest_unsubscribe_token: string;
}

/**
 * Daily: ask people who saved (or applied to) an opportunity how it went,
 * six weeks after it closed (226). One prompt per person per listing, one
 * email per person however many listings are due. Opt-out shares the
 * saved-opportunity reminders flag.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = { listings: 0, people: 0, sent: 0, failed: 0, errors: [] as string[] };

  const { data: opps, error: oppErr } = await admin
    .from("opportunities")
    .select("id, slug, title, organiser")
    .eq("status", "published")
    .lte("deadline", nzDatePlus(-PROMPT_AFTER_DAYS))
    .gt("deadline", nzDatePlus(-PROMPT_AFTER_DAYS - WINDOW_DAYS));
  if (oppErr) return NextResponse.json({ ...results, errors: [oppErr.message] }, { status: 500 });
  results.listings = opps?.length ?? 0;
  if (!opps?.length) return NextResponse.json(results);

  const oppIds = opps.map((o) => o.id);
  const [savedRes, appliedRes, reportedRes, sentRes] = await Promise.all([
    admin.from("user_saved_opportunities").select("user_id, opportunity_id").in("opportunity_id", oppIds),
    admin.from("opportunity_applications").select("artist_id, opportunity_id").in("opportunity_id", oppIds),
    admin.from("opportunity_outcomes").select("user_id, opportunity_id").in("opportunity_id", oppIds),
    admin.from("outcome_prompt_sends").select("user_id, opportunity_id").in("opportunity_id", oppIds),
  ]);
  for (const r of [savedRes, appliedRes, reportedRes, sentRes]) if (r.error) results.errors.push(r.error.message);

  const key = (u: string, o: string) => `${u}:${o}`;
  const skip = new Set([
    ...(reportedRes.data ?? []).map((r) => key(r.user_id, r.opportunity_id)),
    ...(sentRes.data ?? []).map((r) => key(r.user_id, r.opportunity_id)),
  ]);
  const byUser = new Map<string, Set<string>>();
  const add = (userId: string, oppId: string) => {
    if (skip.has(key(userId, oppId))) return;
    byUser.set(userId, (byUser.get(userId) ?? new Set()).add(oppId));
  };
  for (const r of savedRes.data ?? []) add(r.user_id, r.opportunity_id);
  for (const r of appliedRes.data ?? []) add(r.artist_id, r.opportunity_id);
  if (byUser.size === 0) return NextResponse.json(results);

  const profiles = new Map<string, ProfileRow>();
  const ids = [...byUser.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, email_verified_at, deadline_reminders, digest_unsubscribe_token")
      .in("id", ids.slice(i, i + 200));
    if (error) results.errors.push(`profiles: ${error.message}`);
    for (const p of (data ?? []) as ProfileRow[]) profiles.set(p.id, p);
  }

  const oppById = new Map(opps.map((o) => [o.id, o]));
  const emails: Array<{ key: string; to: string; subject: string; html: string }> = [];
  for (const [userId, oppSet] of byUser) {
    const p = profiles.get(userId);
    if (!p?.email || !p.email_verified_at || isShadowEmail(p.email) || p.deadline_reminders === false) continue;
    const items: OutcomePromptItem[] = [...oppSet].map((id) => {
      const o = oppById.get(id)!;
      return { title: o.title, organiser: o.organiser, href: `/opportunities/${o.slug ?? o.id}/outcome` };
    });
    const { subject, html } = buildOutcomePromptEmail({ items, unsubscribeToken: p.digest_unsubscribe_token });
    emails.push({ key: userId, to: p.email, subject, html });
  }
  results.people = emails.length;
  if (emails.length === 0) return NextResponse.json(results);

  const failed = new Set(await sendResultEmails(emails));
  results.failed = failed.size;
  results.sent = emails.length - failed.size;

  const logRows = emails
    .filter((e) => !failed.has(e.key))
    .flatMap((e) => [...byUser.get(e.key)!].map((opportunity_id) => ({ user_id: e.key, opportunity_id })));
  if (logRows.length > 0) {
    const { error } = await admin
      .from("outcome_prompt_sends")
      .upsert(logRows, { onConflict: "user_id,opportunity_id", ignoreDuplicates: true });
    if (error) results.errors.push(`log: ${error.message}`);
  }

  return NextResponse.json(results);
}

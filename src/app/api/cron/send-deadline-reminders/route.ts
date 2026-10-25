import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import {
  buildDeadlineReminderEmail,
  nzDatePlus,
  type ReminderItem,
  type ReminderWindow,
} from "@/lib/deadline-reminders";

const WINDOWS: Array<{ window: ReminderWindow; days: number }> = [
  { window: "7d", days: 7 },
  { window: "2d", days: 2 },
];

interface SavedRow {
  user_id: string;
  opportunity_id: string;
  opportunity: {
    id: string;
    slug: string | null;
    title: string;
    organiser: string;
    deadline: string;
  } | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  deadline_reminders: boolean | null;
  digest_unsubscribe_token: string;
}

interface EmailReminderRow {
  id: string;
  email: string;
  unsubscribe_token: string;
  sent_windows: string[] | null;
  opportunity: { id: string; slug: string | null; title: string; organiser: string; deadline: string } | null;
}

/** Reminders for addresses with no account (email_reminders, migration 219). */
async function sendEmailOnlyReminders(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const out = { sent: 0, failed: 0, errors: [] as string[] };
  const byEmail = new Map<string, { token: string; items: ReminderItem[]; rows: Array<{ id: string; windows: string[]; window: ReminderWindow }> }>();

  for (const { window, days } of WINDOWS) {
    const { data, error } = await admin
      .from("email_reminders")
      .select(
        "id, email, unsubscribe_token, sent_windows, opportunity:opportunities!inner(id, slug, title, organiser, deadline, is_active, status)"
      )
      .eq("opportunity.deadline", nzDatePlus(days))
      .eq("opportunity.is_active", true)
      .eq("opportunity.status", "published");
    if (error) {
      out.errors.push(`email-only ${window}: ${error.message}`);
      continue;
    }
    for (const row of (data ?? []) as unknown as EmailReminderRow[]) {
      if (!row.opportunity || (row.sent_windows ?? []).includes(window)) continue;
      const entry = byEmail.get(row.email) ?? { token: row.unsubscribe_token, items: [], rows: [] };
      entry.items.push({
        window,
        title: row.opportunity.title,
        organiser: row.opportunity.organiser,
        deadline: row.opportunity.deadline,
        href: `/opportunities/${row.opportunity.slug ?? row.opportunity.id}`,
      });
      entry.rows.push({ id: row.id, windows: row.sent_windows ?? [], window });
      byEmail.set(row.email, entry);
    }
  }
  if (byEmail.size === 0) return out;

  const emails = [...byEmail.entries()].map(([email, entry]) => {
    const { subject, html } = buildDeadlineReminderEmail({ items: entry.items, unsubscribeToken: entry.token });
    return { key: email, to: email, subject, html };
  });
  const failed = new Set(await sendResultEmails(emails));
  out.failed = failed.size;
  out.sent = byEmail.size - failed.size;

  for (const [email, entry] of byEmail) {
    if (failed.has(email)) continue;
    for (const r of entry.rows) {
      const { error } = await admin
        .from("email_reminders")
        .update({ sent_windows: [...r.windows, r.window] })
        .eq("id", r.id);
      if (error) out.errors.push(`email-only log: ${error.message}`);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = { candidates: 0, users: 0, sent: 0, failed: 0, errors: [] as string[] };

  // Group everything due today by person: one email per person, however many
  // of their saved listings are closing.
  const byUser = new Map<string, { email: string; token: string; items: Array<ReminderItem & { opportunityId: string }> }>();

  for (const { window, days } of WINDOWS) {
    const deadline = nzDatePlus(days);

    // user_id points at auth.users, so profiles can't be embedded: look them up after.
    const { data, error } = await admin
      .from("user_saved_opportunities")
      .select(
        "user_id, opportunity_id, opportunity:opportunities!inner(id, slug, title, organiser, deadline, is_active, status)"
      )
      // 'applied' rows share this table; no point nudging someone who already applied.
      .eq("status", "saved")
      .eq("opportunity.deadline", deadline)
      .eq("opportunity.is_active", true)
      .eq("opportunity.status", "published");

    if (error) {
      results.errors.push(`${window}: ${error.message}`);
      continue;
    }

    const rows = (data ?? []) as unknown as SavedRow[];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const profiles = new Map<string, ProfileRow>();
    if (ids.length > 0) {
      const { data: profs, error: profErr } = await admin
        .from("profiles")
        .select("id, email, email_verified_at, deadline_reminders, digest_unsubscribe_token")
        .in("id", ids);
      if (profErr) {
        results.errors.push(`${window} profiles: ${profErr.message}`);
        continue;
      }
      for (const p of (profs ?? []) as ProfileRow[]) profiles.set(p.id, p);
    }

    for (const row of rows) {
      results.candidates++;
      const opp = row.opportunity;
      const profile = profiles.get(row.user_id);
      if (!opp || !profile?.email || !profile.email_verified_at) continue;
      if (profile.deadline_reminders === false) continue;

      const entry = byUser.get(row.user_id) ?? {
        email: profile.email,
        token: profile.digest_unsubscribe_token,
        items: [],
      };
      entry.items.push({
        window,
        opportunityId: opp.id,
        title: opp.title,
        organiser: opp.organiser,
        deadline: opp.deadline,
        href: `/opportunities/${opp.slug ?? opp.id}`,
      });
      byUser.set(row.user_id, entry);
    }
  }

  // Drop anything already sent for that window (the cron may run twice).
  const userIds = [...byUser.keys()];
  if (userIds.length > 0) {
    const { data: sentRows } = await admin
      .from("deadline_reminder_sends")
      .select("user_id, opportunity_id, reminder_window")
      .in("user_id", userIds);
    const already = new Set(
      (sentRows ?? []).map((r) => `${r.user_id}:${r.opportunity_id}:${r.reminder_window}`)
    );
    for (const [userId, entry] of byUser) {
      entry.items = entry.items.filter((i) => !already.has(`${userId}:${i.opportunityId}:${i.window}`));
      if (entry.items.length === 0) byUser.delete(userId);
    }
  }

  results.users = byUser.size;
  const emailOnly = await sendEmailOnlyReminders(admin);
  results.errors.push(...emailOnly.errors);
  Object.assign(results, { emailOnlySent: emailOnly.sent, emailOnlyFailed: emailOnly.failed });
  if (byUser.size === 0) return NextResponse.json(results);

  const emails = [...byUser.entries()].map(([userId, entry]) => {
    const { subject, html } = buildDeadlineReminderEmail({ items: entry.items, unsubscribeToken: entry.token });
    return { key: userId, to: entry.email, subject, html };
  });

  const failed = new Set(await sendResultEmails(emails));
  results.failed = failed.size;

  const logRows = [...byUser.entries()]
    .filter(([userId]) => !failed.has(userId))
    .flatMap(([userId, entry]) =>
      entry.items.map((i) => ({
        user_id: userId,
        opportunity_id: i.opportunityId,
        reminder_window: i.window,
      }))
    );

  if (logRows.length > 0) {
    const { error } = await admin.from("deadline_reminder_sends").upsert(logRows, {
      onConflict: "user_id,opportunity_id,reminder_window",
    });
    if (error) results.errors.push(`log: ${error.message}`);
  }
  results.sent = byUser.size - failed.size;

  return NextResponse.json(results);
}

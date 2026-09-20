"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildArtistInviteEmail, type OrgInviteCopy } from "@/lib/email";
import {
  parseInviteCsv,
  summarise,
  type InvitePreview,
  type PreviewRow,
} from "@/lib/artist-invites";
import { captureServerEvent } from "@/lib/posthog-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractInviteContactsWithAI } from "@/lib/artist-invite-ai";
import { revalidatePath } from "next/cache";

/**
 * Bulk artist invitation, on an organisation's behalf.
 *
 * Nothing sends without a confirmed preview. An organisation handing over its
 * whole contact list is taking a reputational risk with its own artists, so it
 * has to see "186 will be invited, 12 already have accounts" before a single
 * email leaves.
 */

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";

interface Org {
  id: string;
  name: string;
  regionName: string | null;
  regionId: string | null;
  /** Whatever this organisation has rewritten. Nulls fall back to our copy. */
  copy: OrgInviteCopy;
}

/**
 * Every action here re-checks the caller. A server action is a public endpoint,
 * and this one can send thousands of emails carrying someone else's name.
 */
async function requireOrg(): Promise<{ org?: Org; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(`id, full_name, username, role, org_category, region_id, regions(name),
            org_invite_subject, org_invite_headline, org_invite_subhead,
            org_invite_message, org_invite_reply_to`)
    .eq("id", user.id)
    .single();

  const p = data as {
    id: string;
    full_name: string | null;
    username: string;
    role: string;
    org_category: string | null;
    region_id: string | null;
    regions: { name: string } | null;
    org_invite_subject: string | null;
    org_invite_headline: string | null;
    org_invite_subhead: string | null;
    org_invite_message: string | null;
    org_invite_reply_to: string | null;
  } | null;

  if (!p || (p.role !== "partner" && p.role !== "admin")) {
    return { error: "Only organisations can invite artists." };
  }

  return {
    org: {
      id: p.id,
      name: p.full_name ?? p.username,
      regionName: p.regions?.name ?? null,
      regionId: p.region_id,
      copy: {
        subject: p.org_invite_subject,
        headline: p.org_invite_headline,
        subhead: p.org_invite_subhead,
        message: p.org_invite_message,
        replyTo: p.org_invite_reply_to,
      },
    },
  };
}

/**
 * Reads the uploaded file and works out what would happen to every row.
 *
 * Sends nothing. The rows come back to the client so the organisation can read
 * them, and are re-derived from the same text on confirm rather than trusted
 * back from the browser.
 */
export async function previewArtistInvites(csvText: string): Promise<InvitePreview> {
  const { org, error } = await requireOrg();
  if (!org) {
    return { rows: [], counts: summarise([]), total: 0, columns: [], error: error ?? "Not authorised." };
  }

  return buildPreview(org.id, csvText);
}

/**
 * Rewrites a file the ordinary parser could not read into plain
 * Email/Name/Discipline/City CSV, using Claude. Sends nothing to anyone: the
 * result goes back through the normal preview, so the organisation still sees
 * every row before any invitation leaves.
 *
 * Only reached when the organisation has chosen it, because the file's
 * contents leave our servers for Anthropic's API.
 */
export async function readInviteFileWithAI(
  fileText: string
): Promise<{ csv?: string; found?: number; dropped?: number; error?: string }> {
  const { org, error } = await requireOrg();
  if (!org) return { error: error ?? "Not authorised." };

  // Each call is paid for and sends personal data offshore, so it is metered.
  if (!(await checkRateLimit(`invite-ai:${org.id}`, 10, 3600))) {
    return { error: "That is a lot of files in a short time. Try again in a little while." };
  }

  return extractInviteContactsWithAI(fileText);
}

async function buildPreview(orgId: string, csvText: string): Promise<InvitePreview> {
  const parsed = parseInviteCsv(csvText);

  if (parsed.error && parsed.rows.length === 0) {
    return {
      rows: [],
      counts: summarise([]),
      total: 0,
      columns: parsed.columns,
      error: parsed.error,
    };
  }

  const emails = parsed.rows.filter((r) => !r.problem).map((r) => r.email);

  const admin = createAdminClient();

  // Two lookups, both bounded by the addresses in the file.
  const [{ data: accounts }, { data: invited }] = await Promise.all([
    emails.length
      ? admin.from("profiles").select("email, username").in("email", emails)
      : Promise.resolve({ data: [] }),
    emails.length
      ? admin
          .from("artist_invitations")
          .select("email")
          .eq("org_profile_id", orgId)
          .in("email", emails)
      : Promise.resolve({ data: [] }),
  ]);

  const byEmail = new Map(
    ((accounts ?? []) as Array<{ email: string | null; username: string }>)
      .filter((a) => a.email)
      .map((a) => [a.email!.trim().toLowerCase(), a.username])
  );
  const alreadyInvited = new Set(
    ((invited ?? []) as Array<{ email: string }>).map((r) => r.email)
  );

  const rows: PreviewRow[] = parsed.rows.map((r) => {
    if (r.problem) return { ...r, outcome: "invalid" as const };
    const username = byEmail.get(r.email);
    if (username) {
      return { ...r, outcome: "existing" as const, existingUsername: username };
    }
    if (alreadyInvited.has(r.email)) {
      return { ...r, outcome: "already_invited" as const };
    }
    return { ...r, outcome: "invite" as const };
  });

  return {
    rows,
    counts: summarise(rows),
    total: rows.length,
    columns: parsed.columns,
    error: parsed.error,
  };
}

/**
 * Sends the invitations the preview said it would.
 *
 * Takes the same file text rather than the reviewed rows: re-deriving the
 * decision server-side means a tampered payload cannot mail addresses the
 * preview never showed, or relabel an existing account as a fresh invite.
 */
export async function sendArtistInvites(
  csvText: string,
  filename: string | null
): Promise<{ sent: number; skipped: number; error?: string }> {
  const { org, error } = await requireOrg();
  if (!org) return { sent: 0, skipped: 0, error: error ?? "Not authorised." };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: 0, skipped: 0, error: "Email is not configured." };

  const preview = await buildPreview(org.id, csvText);
  const toInvite = preview.rows.filter((r) => r.outcome === "invite");
  const existing = preview.rows.filter((r) => r.outcome === "existing");

  if (toInvite.length === 0) {
    return {
      sent: 0,
      skipped: preview.total,
      error: "Nothing to send. Every row was already on Patronage or unusable.",
    };
  }

  const admin = createAdminClient();

  const { data: batchRow } = await admin
    .from("artist_invite_batches")
    .insert({
      org_profile_id: org.id,
      created_by: org.id,
      filename,
      row_count: preview.total,
      new_count: preview.counts.invite,
      existing_count: preview.counts.existing,
      invalid_count: preview.counts.invalid + preview.counts.already_invited,
    })
    .select("id")
    .single();

  const batchId = (batchRow as { id: string } | null)?.id ?? null;

  // Rows for the addresses that already have accounts, recorded but never
  // mailed. They are how an organisation sees that its list overlaps ours, and
  // they stop a second upload treating the same person as new.
  if (existing.length > 0) {
    await admin.from("artist_invitations").upsert(
      existing.map((r) => ({
        batch_id: batchId,
        org_profile_id: org.id,
        email: r.email,
        full_name: r.fullName,
        disciplines: r.disciplines,
        city: r.city,
        region_id: org.regionId,
        status: "existing",
      })),
      { onConflict: "org_profile_id,email", ignoreDuplicates: true }
    );
  }

  const { data: created } = await admin
    .from("artist_invitations")
    .insert(
      toInvite.map((r) => ({
        batch_id: batchId,
        org_profile_id: org.id,
        email: r.email,
        full_name: r.fullName,
        disciplines: r.disciplines,
        city: r.city,
        region_id: org.regionId,
        status: "pending",
      }))
    )
    .select("id, email, full_name, token");

  const invitations = (created ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    token: string;
  }>;

  if (invitations.length === 0) {
    return { sent: 0, skipped: preview.total, error: "Could not create invitations." };
  }

  const resend = new Resend(apiKey);
  let sent = 0;

  for (let i = 0; i < invitations.length; i += 100) {
    const chunk = invitations.slice(i, i + 100);

    const batch = chunk.map((inv) => {
      const { subject, html, replyTo } = buildArtistInviteEmail({
        orgName: org.name,
        regionName: org.regionName,
        firstName: firstNameOf(inv.full_name),
        token: inv.token,
        copy: org.copy,
      });
      return {
        from: FROM,
        to: inv.email,
        subject,
        html,
        // An artist who answers should reach the organisation that wrote to
        // them, not our no-reply address.
        ...(replyTo && { replyTo }),
        tags: [{ name: "type", value: "artist_invite" }],
      };
    });

    const { error: sendError } = await resend.batch.send(batch);
    if (sendError) continue;

    sent += chunk.length;
    await admin
      .from("artist_invitations")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .in(
        "id",
        chunk.map((c) => c.id)
      );
  }

  if (batchId) {
    await admin
      .from("artist_invite_batches")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", batchId);
  }

  captureServerEvent("org_artist_invites_sent", org.id, {
    org_id: org.id,
    invited: sent,
    already_on_platform: preview.counts.existing,
    unusable: preview.counts.invalid,
  }).catch(() => {});

  revalidatePath("/partner/roster");

  return { sent, skipped: preview.total - sent };
}

/** First name only, because "Kia ora Jane Smith-Whatu" reads like a form letter. */
function firstNameOf(fullName: string | null): string | null {
  if (!fullName?.trim()) return null;
  const first = fullName.trim().split(/\s+/)[0];
  return first.length > 1 ? first : null;
}

/**
 * Saves the organisation's own wording.
 *
 * An empty field means "use the Patronage default", stored as null rather than
 * an empty string so the default stays editable in code later without having to
 * rewrite rows that never chose anything.
 */
export async function saveInviteCopy(input: {
  subject: string;
  headline: string;
  subhead: string;
  message: string;
  replyTo: string;
}): Promise<{ error?: string }> {
  const { org, error } = await requireOrg();
  if (!org) return { error: error ?? "Not authorised." };

  const replyTo = input.replyTo.trim();
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(replyTo)) {
    return { error: "That reply-to address does not look right." };
  }

  // Mirrors the check constraint in 188. Caught here so the person sees a
  // sentence rather than a Postgres error.
  const limits: Array<[string, string, number]> = [
    ["Subject", input.subject, 150],
    ["Headline", input.headline, 200],
    ["Second line", input.subhead, 300],
    ["Your message", input.message, 600],
  ];
  for (const [label, value, max] of limits) {
    if (value.trim().length > max) {
      return { error: `${label} is too long. Keep it under ${max} characters.` };
    }
  }

  const admin = createAdminClient();
  const { error: writeError } = await admin
    .from("profiles")
    .update({
      org_invite_subject: input.subject.trim() || null,
      org_invite_headline: input.headline.trim() || null,
      org_invite_subhead: input.subhead.trim() || null,
      org_invite_message: input.message.trim() || null,
      org_invite_reply_to: replyTo || null,
    })
    .eq("id", org.id);

  if (writeError) return { error: writeError.message };

  revalidatePath("/partner/roster");
  return {};
}

/**
 * Renders the invitation exactly as it would send, for the preview pane.
 *
 * Built server-side from the same function the send uses, so the preview cannot
 * drift from the real thing.
 */
export async function renderInvitePreview(copy: {
  subject: string;
  headline: string;
  subhead: string;
  message: string;
}): Promise<{ subject: string; html: string } | { error: string }> {
  const { org, error } = await requireOrg();
  if (!org) return { error: error ?? "Not authorised." };

  const { subject, html } = buildArtistInviteEmail({
    orgName: org.name,
    regionName: org.regionName,
    firstName: "Hemi",
    token: "00000000-0000-0000-0000-000000000000",
    copy: {
      subject: copy.subject.trim() || null,
      headline: copy.headline.trim() || null,
      subhead: copy.subhead.trim() || null,
      message: copy.message.trim() || null,
    },
  });

  return { subject, html };
}

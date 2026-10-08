"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import {
  buildCampaignSelectedEmailContent,
  buildHighResRequestEmailContent,
  buildRejectionEmailContent,
  buildSelectedEmailContent,
  buildShortlistEmailContent,
  sendResultEmails,
} from "@/lib/email";
import { createCampaignForSelection } from "@/lib/campaigns";
import type { PipelineConfig } from "@/types/database";

type NotifType = "shortlisted" | "rejected" | "selected" | "approved_pending_assets";
type Admin = ReturnType<typeof createAdminClient>;

const ADVANCED = ["selected", "approved_pending_assets", "production_ready"];

export interface ResultsMessages {
  selected: string;
  shortlisted: string;
  rejected: string;
}

export interface ResultsGroup {
  key: "selected" | "approved_pending_assets" | "shortlisted" | "rejected";
  label: string;
  people: Array<{ id: string; name: string; note: string | null }>;
}

export interface ResultsPreview {
  title: string;
  groups: ResultsGroup[];
  /** Applications still at "New": they are left alone and nobody is told anything. */
  undecided: number;
  /** Decisions already published that have not yet reached the artist's inbox. */
  unsent: number;
  applicationsOpen: boolean;
  deadline: string | null;
  everPublished: boolean;
  /** How many result emails have gone out so far, and when the first batch was sent. */
  sentCount: number;
  firstSentAt: string | null;
  messages: ResultsMessages;
  samples: Record<string, { subject: string; html: string }>;
}

/** Which email an artist gets for a status, or null if none is due. */
function notifTypeFor(status: string, released: string | null): NotifType | null {
  switch (status) {
    case "shortlisted": return "shortlisted";
    case "selected": return "selected";
    case "approved_pending_assets": return "approved_pending_assets";
    case "rejected": return "rejected";
    // Already told they were selected: moving on to "files received" needs no new email.
    case "production_ready": return released && ADVANCED.includes(released) ? null : "selected";
    default: return null;
  }
}

async function ownerAccess(opportunityId: string) {
  const { user } = await getServerUser();
  if (!user) return null;
  const admin = createAdminClient();
  const [{ data: profile }, { data: opp }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", user.id).single(),
    admin
      .from("opportunities")
      .select("id, title, organiser, type, profile_id, pipeline_config, is_active, deadline, results_published_at")
      .eq("id", opportunityId)
      .single(),
  ]);
  if (!opp) return null;
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  if (!isAdmin && opp.profile_id !== user.id) return null;
  return { admin, user, opp };
}

interface AppRow {
  id: string;
  artist_id: string;
  status: string;
  released_status: string | null;
  selection_message: string | null;
  rejection_reason: string | null;
}

async function loadDue(admin: Admin, opportunityId: string) {
  const [{ data: apps }, { data: decisions }] = await Promise.all([
    // `status` on the artist's row is what they have been told so far.
    admin
      .from("opportunity_applications")
      .select("id, artist_id, status")
      .eq("opportunity_id", opportunityId)
      .order("created_at", { ascending: true }),
    admin
      .from("application_decisions")
      .select("application_id, status, rejection_reason, selection_message")
      .eq("opportunity_id", opportunityId),
  ]);
  const decisionByApp = new Map((decisions ?? []).map((d) => [d.application_id as string, d]));
  const rows: AppRow[] = (apps ?? []).map((a) => {
    const d = decisionByApp.get(a.id as string);
    return {
      id: a.id as string,
      artist_id: a.artist_id as string,
      status: (d?.status as string | undefined) ?? "pending",
      released_status: a.status as string,
      selection_message: (d?.selection_message as string | null | undefined) ?? null,
      rejection_reason: (d?.rejection_reason as string | null | undefined) ?? null,
    };
  });
  const ids = rows.map((a) => a.id);

  const [{ data: ledger }, { data: profiles }] = await Promise.all([
    ids.length ? admin.from("notification_ledger").select("application_id, notification_type").in("application_id", ids) : Promise.resolve({ data: [] }),
    rows.length
      ? admin.from("profiles").select("id, full_name, username").in("id", [...new Set(rows.map((a) => a.artist_id))])
      : Promise.resolve({ data: [] }),
  ]);
  const sent = new Set((ledger ?? []).map((l) => `${l.application_id}:${l.notification_type}`));
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? (p.username as string)]));

  const due = rows
    .filter((a) => a.status !== "pending")
    .map((a) => {
      const type = notifTypeFor(a.status, a.released_status);
      const needsRelease = a.released_status !== a.status;
      const needsEmail = !!type && !sent.has(`${a.id}:${type}`);
      return { app: a, type, needsRelease, needsEmail, name: names.get(a.artist_id) ?? "Artist" };
    })
    .filter((d) => d.needsRelease || d.needsEmail);

  return { rows, due, names };
}

function readMessages(pc: PipelineConfig | null): ResultsMessages {
  const raw = (pc as { results_messages?: Partial<ResultsMessages> } | null)?.results_messages ?? {};
  return { selected: raw.selected ?? "", shortlisted: raw.shortlisted ?? "", rejected: raw.rejected ?? "" };
}

function contentFor(
  type: NotifType,
  ctx: { name: string; title: string; requiresCampaign: boolean; messages: ResultsMessages; app: AppRow },
): { subject: string; html: string } {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
  switch (type) {
    case "shortlisted":
      return buildShortlistEmailContent({ artistName: ctx.name, opportunityTitle: ctx.title, message: ctx.messages.shortlisted });
    case "rejected":
      return buildRejectionEmailContent({
        artistName: ctx.name,
        opportunityTitle: ctx.title,
        reason: ctx.app.rejection_reason,
        message: ctx.messages.rejected,
      });
    case "approved_pending_assets":
      return buildHighResRequestEmailContent({
        artistName: ctx.name,
        opportunityTitle: ctx.title,
        dashboardUrl: `${siteUrl}/studio/opportunities?of=applied`,
      });
    default: {
      const customMessage = ctx.app.selection_message?.trim() || ctx.messages.selected;
      return ctx.requiresCampaign
        ? buildCampaignSelectedEmailContent({ artistName: ctx.name, opportunityTitle: ctx.title, customMessage })
        : buildSelectedEmailContent({ artistName: ctx.name, opportunityTitle: ctx.title, customMessage });
    }
  }
}

/** What would go out if the organiser published now. Nothing is sent or changed. */
export async function getResultsPreview(opportunityId: string): Promise<ResultsPreview | null> {
  const access = await ownerAccess(opportunityId);
  if (!access) return null;
  const { admin, opp } = access;
  const pc = (opp.pipeline_config ?? null) as PipelineConfig | null;
  const messages = readMessages(pc);
  const requiresCampaign = !!pc?.post_selection?.requires_campaign;
  const { rows, due } = await loadDue(admin, opportunityId);

  const LABELS: Record<ResultsGroup["key"], string> = {
    selected: "Selected",
    approved_pending_assets: "Selected, files requested",
    shortlisted: "Shortlisted",
    rejected: "Not selected",
  };
  const groups: ResultsGroup[] = (Object.keys(LABELS) as ResultsGroup["key"][]).map((key) => ({
    key,
    label: LABELS[key],
    people: due
      .filter((d) => d.type === key)
      .map((d) => ({ id: d.app.id, name: d.name, note: key === "rejected" ? d.app.rejection_reason : key === "selected" ? d.app.selection_message : null })),
  })).filter((g) => g.people.length > 0);

  const samples: Record<string, { subject: string; html: string }> = {};
  for (const g of groups) {
    const d = due.find((x) => x.type === g.key);
    if (d && d.type) samples[g.key] = contentFor(d.type, { name: d.name, title: opp.title as string, requiresCampaign, messages, app: d.app });
  }

  const today = new Date().toISOString().split("T")[0];
  const { count: sentCount } = await admin
    .from("notification_ledger")
    .select("application_id", { count: "exact", head: true })
    .in("application_id", rows.map((r) => r.id as string));
  return {
    title: opp.title as string,
    groups,
    undecided: rows.filter((a) => a.status === "pending").length,
    unsent: due.filter((d) => !d.needsRelease && d.needsEmail).length,
    applicationsOpen: opp.is_active !== false && (!opp.deadline || (opp.deadline as string) >= today),
    deadline: (opp.deadline as string | null) ?? null,
    everPublished: !!opp.results_published_at,
    sentCount: sentCount ?? 0,
    firstSentAt: (opp.results_published_at as string | null) ?? null,
    messages,
    samples,
  };
}

/** The note an organiser adds to every email of one kind. */
export async function saveResultsMessages(opportunityId: string, messages: ResultsMessages): Promise<{ error?: string }> {
  const access = await ownerAccess(opportunityId);
  if (!access) return { error: "Not authorised" };
  const clean: ResultsMessages = {
    selected: messages.selected.trim().slice(0, 2000),
    shortlisted: messages.shortlisted.trim().slice(0, 2000),
    rejected: messages.rejected.trim().slice(0, 2000),
  };
  const existing = (access.opp.pipeline_config ?? {}) as PipelineConfig;
  const { error } = await access.admin
    .from("opportunities")
    .update({ pipeline_config: { ...existing, results_messages: clean } })
    .eq("id", opportunityId);
  return error ? { error: error.message } : {};
}

export interface PublishResult {
  error?: string;
  released?: number;
  emailing?: number;
}

/**
 * Publish decisions. This is the only place artists are told anything: it makes
 * each decision visible on their dashboard, records the win on the profile of
 * anyone selected, and sends one email per person. Running it again sends only
 * what has not already gone out, so a failed batch can be retried safely.
 */
export async function publishResults(opportunityId: string, confirmation: string): Promise<PublishResult> {
  if (confirmation.trim().toUpperCase() !== "SEND") return { error: "Type SEND to confirm." };
  const access = await ownerAccess(opportunityId);
  if (!access) return { error: "Not authorised" };
  const { admin, opp } = access;

  const pc = (opp.pipeline_config ?? null) as PipelineConfig | null;
  const messages = readMessages(pc);
  const requiresCampaign = !!pc?.post_selection?.requires_campaign;
  const title = opp.title as string;
  const { due } = await loadDue(admin, opportunityId);
  if (due.length === 0) return { released: 0, emailing: 0 };

  const now = new Date().toISOString();

  // 1. Make the decisions visible to the artists they concern.
  await Promise.all(
    due.filter((d) => d.needsRelease).map((d) =>
      admin
        .from("opportunity_applications")
        .update({
          status: d.app.status,
          // From here on this is the feedback the artist can see.
          rejection_reason: d.app.status === "rejected" ? d.app.rejection_reason : null,
          released_at: now,
        })
        .eq("id", d.app.id),
    ),
  );

  // 2. Public consequences of a selection, now that it is official.
  for (const d of due.filter((x) => x.needsRelease)) {
    const was = d.app.released_status;
    const nowAdvanced = ADVANCED.includes(d.app.status);
    const wasAdvanced = !!was && ADVANCED.includes(was);

    if (nowAdvanced) {
      await admin.from("profile_achievements").upsert(
        {
          profile_id: d.app.artist_id,
          opportunity_id: opportunityId,
          opportunity_title: title,
          organisation: (opp.organiser as string) ?? "",
          type: (opp.type as string) ?? "Grant",
          year: new Date().getFullYear(),
          verified: true,
        },
        { onConflict: "profile_id,opportunity_id" },
      );
    } else if (wasAdvanced) {
      await admin.from("profile_achievements").delete().eq("profile_id", d.app.artist_id).eq("opportunity_id", opportunityId);
    }

    if (d.app.status === "selected" && !wasAdvanced) {
      const { data: project } = await admin
        .from("projects")
        .upsert({ artist_id: d.app.artist_id, title }, { onConflict: "artist_id", ignoreDuplicates: true })
        .select("id")
        .maybeSingle();
      if (project?.id) {
        await admin.from("project_updates").insert({
          project_id: project.id,
          artist_id: d.app.artist_id,
          body: `Selected for ${title} (${opp.type})`,
          content_type: "text",
        });
      }
      if (requiresCampaign) {
        after(async () => {
          try {
            const { data: artist } = await admin.from("profiles").select("username").eq("id", d.app.artist_id).single();
            if (artist?.username) {
              await createCampaignForSelection({
                artistProfileId: d.app.artist_id,
                artistUsername: artist.username as string,
                opportunityId,
                opportunityTitle: title,
                opportunityType: opp.type as string,
                applicationId: d.app.id,
              });
            }
          } catch (err) {
            console.error("[results] campaign creation failed:", err);
          }
        });
      }
    }
  }

  // 3. One email each, and a notice in the artist's bell.
  const toEmail = due.filter((d) => d.type && d.needsEmail);
  const claimed: typeof toEmail = [];
  for (const d of toEmail) {
    const { error } = await admin.from("notification_ledger").insert({ application_id: d.app.id, notification_type: d.type });
    if (!error) claimed.push(d);
    else if (error.code !== "23505") {
      console.error("[results] ledger unavailable, sending without a record:", error.message);
      claimed.push(d);
    }
  }

  if (claimed.length > 0) {
    await admin.from("notifications").insert(
      claimed.map((d) => ({
        user_id: d.app.artist_id,
        type: "note",
        title: `Update on your application for ${title}`,
        body: null,
        link: "/studio/opportunities?of=applied",
      })),
    );
  }

  after(async () => {
    const items: Array<{ key: string; to: string; subject: string; html: string }> = [];
    for (let i = 0; i < claimed.length; i += 10) {
      await Promise.all(
        claimed.slice(i, i + 10).map(async (d) => {
          const { data } = await admin.auth.admin.getUserById(d.app.artist_id);
          const to = data?.user?.email;
          if (!to || !d.type) {
            await admin.from("notification_ledger").delete().eq("application_id", d.app.id).eq("notification_type", d.type);
            return;
          }
          const content = contentFor(d.type, { name: d.name, title, requiresCampaign, messages, app: d.app });
          items.push({ key: `${d.app.id}:${d.type}`, to, subject: content.subject, html: content.html });
        }),
      );
    }
    const failed = new Set(await sendResultEmails(items));
    for (const key of failed) {
      const [appId, type] = key.split(":");
      await admin.from("notification_ledger").delete().eq("application_id", appId).eq("notification_type", type);
    }
    if (failed.size > 0) console.error(`[results] ${failed.size} of ${items.length} emails failed; publish again to retry them.`);
  });

  if (!opp.results_published_at) {
    await admin.from("opportunities").update({ results_published_at: now }).eq("id", opportunityId);
  }

  revalidatePath(`/partner/dashboard/${opportunityId}`);
  return { released: due.filter((d) => d.needsRelease).length, emailing: claimed.length };
}

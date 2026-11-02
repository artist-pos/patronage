"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResultEmails } from "@/lib/email";
import { isShadowEmail } from "@/lib/shadow";
import { buildOpportunityInviteEmail } from "@/lib/opportunity-invites";
import type { BoardItemType } from "@/types/database";

const ITEM_TYPES: BoardItemType[] = ["artwork", "update", "artist"];
const DEFAULT_BOARD = "Saved";
/** One invite action reaches at most this many artists. */
const MAX_INVITES = 50;

export interface BoardOption {
  id: string;
  title: string;
  contains: boolean;
}

async function viewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

/** The viewer's boards, and which already hold this item. */
export async function listBoardsForItem(
  itemType: BoardItemType,
  itemId: string,
): Promise<{ boards?: BoardOption[]; error?: string }> {
  if (!ITEM_TYPES.includes(itemType)) return { error: "Unknown item." };
  const { supabase, user } = await viewer();
  if (!user) return { error: "Not authenticated" };

  const [boardsRes, itemsRes] = await Promise.all([
    supabase.from("boards").select("id, title").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("board_items").select("board_id").eq("item_type", itemType).eq("item_id", itemId),
  ]);
  if (boardsRes.error) return { error: boardsRes.error.message };
  const holding = new Set((itemsRes.data ?? []).map((r) => r.board_id));
  return {
    boards: (boardsRes.data ?? []).map((b) => ({ id: b.id, title: b.title, contains: holding.has(b.id) })),
  };
}

/** Add to or remove from one board. */
export async function setBoardItem(
  boardId: string,
  itemType: BoardItemType,
  itemId: string,
  saved: boolean,
): Promise<{ error?: string }> {
  if (!ITEM_TYPES.includes(itemType)) return { error: "Unknown item." };
  const { supabase, user } = await viewer();
  if (!user) return { error: "Not authenticated" };

  if (saved) {
    const { error } = await supabase
      .from("board_items")
      .upsert({ board_id: boardId, item_type: itemType, item_id: itemId }, {
        onConflict: "board_id,item_type,item_id",
        ignoreDuplicates: true,
      });
    if (error) return { error: error.message.includes("under-18") ? "This profile can't be saved." : "Couldn't save that." };
  } else {
    const { error } = await supabase
      .from("board_items")
      .delete()
      .eq("board_id", boardId)
      .eq("item_type", itemType)
      .eq("item_id", itemId);
    if (error) return { error: error.message };
  }
  revalidatePath(`/boards/${boardId}`);
  return {};
}

/** Make a board, optionally saving an item into it straight away. */
export async function createBoard(
  title: string,
  firstItem?: { itemType: BoardItemType; itemId: string },
): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await viewer();
  if (!user) return { error: "Not authenticated" };
  const clean = title.trim().slice(0, 80) || DEFAULT_BOARD;

  const { data, error } = await supabase
    .from("boards")
    .insert({ owner_id: user.id, title: clean })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Couldn't make the board." };

  if (firstItem) {
    const res = await setBoardItem(data.id, firstItem.itemType, firstItem.itemId, true);
    if (res.error) return { id: data.id, error: res.error };
  }
  revalidatePath("/boards");
  return { id: data.id };
}

/** First save with no boards yet: make "Saved" and put the item in it. */
export async function quickSave(
  itemType: BoardItemType,
  itemId: string,
): Promise<{ boardId?: string; error?: string }> {
  const res = await createBoard(DEFAULT_BOARD, { itemType, itemId });
  return { boardId: res.id, error: res.error };
}

export async function updateBoard(
  boardId: string,
  patch: { title?: string; description?: string | null; visibility?: "private" | "link" },
): Promise<{ error?: string }> {
  const { supabase, user } = await viewer();
  if (!user) return { error: "Not authenticated" };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 80);
    if (!t) return { error: "A board needs a name." };
    update.title = t;
  }
  if (patch.description !== undefined) update.description = patch.description?.trim().slice(0, 300) || null;
  if (patch.visibility !== undefined) {
    if (patch.visibility !== "private" && patch.visibility !== "link") return { error: "Unknown visibility." };
    update.visibility = patch.visibility;
  }

  const { error } = await supabase.from("boards").update(update).eq("id", boardId).eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/boards/${boardId}`);
  revalidatePath("/boards");
  return {};
}

export async function deleteBoard(boardId: string): Promise<{ error?: string }> {
  const { supabase, user } = await viewer();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("boards").delete().eq("id", boardId).eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/boards");
  return {};
}

/**
 * An organisation invites artists from one of its boards to apply to one of
 * its open opportunities. The artist hears only that they were invited, never
 * that they were on a shortlist. One invite per artist per opportunity.
 */
export async function inviteToApply(
  boardId: string,
  opportunityId: string,
  artistIds: string[],
): Promise<{ invited?: number; skipped?: number; error?: string }> {
  const { supabase, user } = await viewer();
  if (!user) return { error: "Not authenticated" };

  const [{ data: me }, { data: board }] = await Promise.all([
    supabase.from("profiles").select("role, full_name, username").eq("id", user.id).single(),
    supabase.from("boards").select("id").eq("id", boardId).eq("owner_id", user.id).maybeSingle(),
  ]);
  if (me?.role !== "partner") return { error: "Only organisations can invite artists to apply." };
  if (!board) return { error: "Board not found." };

  const today = new Date().toISOString().slice(0, 10);
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, slug, title, organiser, deadline, profile_id, organiser_profile_id, status, is_active")
    .eq("id", opportunityId)
    .maybeSingle();
  const ownsOpp = !!opp && (opp.profile_id === user.id || opp.organiser_profile_id === user.id);
  if (!opp || !ownsOpp) return { error: "You can only invite artists to your own opportunities." };
  if (opp.status !== "published" || !opp.is_active || (opp.deadline && opp.deadline < today)) {
    return { error: "That opportunity isn't open." };
  }

  // Only artists that really are on this board.
  const { data: onBoard } = await supabase
    .from("board_items")
    .select("artist_id")
    .eq("board_id", boardId)
    .in("artist_id", artistIds.slice(0, MAX_INVITES));
  const candidates = [...new Set((onBoard ?? []).map((r) => r.artist_id))];
  if (candidates.length === 0) return { invited: 0, skipped: 0 };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("opportunity_invites")
    .select("artist_id")
    .eq("opportunity_id", opp.id)
    .in("artist_id", candidates);
  const already = new Set((existing ?? []).map((r) => r.artist_id));
  const fresh = candidates.filter((id) => !already.has(id));
  if (fresh.length === 0) return { invited: 0, skipped: candidates.length };

  const { error: insertErr } = await admin
    .from("opportunity_invites")
    .insert(fresh.map((artist_id) => ({ opportunity_id: opp.id, artist_id, org_id: user.id })));
  if (insertErr) return { error: insertErr.message };

  const orgName = me.full_name ?? me.username;
  const href = `/opportunities/${opp.slug ?? opp.id}`;
  await admin.from("notifications").insert(
    fresh.map((artistId) => ({
      user_id: artistId,
      type: "opportunity_invite",
      title: `${orgName} invited you to apply: ${opp.title}`,
      body: null,
      link: href,
    })),
  );

  const { data: artists } = await admin
    .from("profiles")
    .select("id, email, email_verified_at, full_name, username")
    .in("id", fresh);
  const emails = (artists ?? [])
    .filter((a) => a.email && a.email_verified_at && !isShadowEmail(a.email))
    .map((a) => {
      const { subject, html } = buildOpportunityInviteEmail({
        artistName: a.full_name ?? a.username,
        orgName,
        title: opp.title,
        deadline: opp.deadline,
        href,
      });
      return { key: a.id, to: a.email as string, subject, html };
    });
  // Email is fire-and-forget: the invite and notification already stand.
  if (emails.length > 0) sendResultEmails(emails).catch(console.error);

  return { invited: fresh.length, skipped: candidates.length - fresh.length };
}

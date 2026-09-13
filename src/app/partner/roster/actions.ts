"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { canKeepRoster, defaultRelationship, orgCategory } from "@/lib/org-categories";

/**
 * An organisation's roster: the artists it represents, or who have been through
 * it.
 *
 * Consent is the whole design. An organisation can invite, and can remove, but
 * cannot make an artist appear on its page: every membership starts pending and
 * only the artist can accept. That is why this reuses the collectives tables
 * rather than a new join table, since invitation and acceptance already work
 * there.
 */

interface Caller {
  id: string;
  category: string;
  /** The relationship this category's roster carries, e.g. "participant". */
  relationship: "represented" | "participant";
  name: string;
}

/**
 * Authorises the caller and resolves what kind of roster they may keep.
 *
 * Checked inside every action rather than at the page: a server action is a
 * public endpoint, and this one publishes claims about named people.
 */
async function requireRosterOrg(): Promise<{ caller?: Caller; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, role, org_category, full_name, username")
    .eq("id", user.id)
    .single();

  const p = data as {
    id: string;
    role: string;
    org_category: string | null;
    full_name: string | null;
    username: string;
  } | null;

  if (!p || p.role !== "partner") {
    return { error: "Only organisations can keep a roster." };
  }
  if (!canKeepRoster(p.org_category)) {
    const label = orgCategory(p.org_category)?.label ?? "Your organisation type";
    return {
      error: `${label} does not keep an artist list. Galleries list represented artists, residencies list participants.`,
    };
  }

  const relationship = defaultRelationship(p.org_category);
  if (!relationship) return { error: "Not authorised." };

  return {
    caller: {
      id: p.id,
      category: p.org_category!,
      relationship,
      name: p.full_name ?? p.username,
    },
  };
}

/**
 * Finds or creates the organisation's single roster.
 *
 * One per organisation on purpose. A gallery with two lists of its own artists
 * is a gallery whose page cannot be rendered coherently.
 */
async function ensureRoster(caller: Caller): Promise<string | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("collectives")
    .select("id")
    .eq("org_profile_id", caller.id)
    .limit(1)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: created } = await admin
    .from("collectives")
    .insert({
      name: caller.name,
      created_by: caller.id,
      org_profile_id: caller.id,
      relationship: caller.relationship,
      // A roster's whole purpose is to be seen. Artist-run collectives stay
      // private; this is the opposite case.
      is_public: true,
    })
    .select("id")
    .single();

  return (created as { id: string } | null)?.id ?? null;
}

export async function inviteArtistToRoster(input: {
  artistId: string;
  startYear?: number | null;
  endYear?: number | null;
}): Promise<{ error?: string }> {
  const { caller, error } = await requireRosterOrg();
  if (!caller) return { error };

  const rosterId = await ensureRoster(caller);
  if (!rosterId) return { error: "Could not open your roster." };

  const admin = createAdminClient();

  const { data: artist } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", input.artistId)
    .single();

  const a = artist as { id: string; role: string } | null;
  if (!a || (a.role !== "artist" && a.role !== "owner")) {
    return { error: "That profile is not an artist." };
  }

  const years = normaliseYears(input.startYear, input.endYear);
  if (years.error) return { error: years.error };

  const { error: insertError } = await admin.from("collective_members").insert({
    collective_id: rosterId,
    user_id: input.artistId,
    role: "member",
    // Pending until the artist accepts. Nothing renders publicly before that.
    status: "pending",
    start_year: years.startYear,
    end_year: years.endYear,
  });

  if (insertError) {
    if (insertError.code === "23505") return { error: "They are already on your list." };
    return { error: insertError.message };
  }

  await notifyArtist(caller, input.artistId, rosterId);

  revalidatePath("/partner/roster");
  return {};
}

/** Years are the substance of a participant entry, so they are validated, not coerced. */
function normaliseYears(
  start?: number | null,
  end?: number | null
): { startYear: number | null; endYear: number | null; error?: string } {
  const s = start ?? null;
  const e = end ?? null;
  const thisYear = new Date().getFullYear();

  for (const [label, v] of [["Start year", s], ["End year", e]] as const) {
    if (v === null) continue;
    if (!Number.isInteger(v) || v < 1900 || v > thisYear + 1) {
      return { startYear: null, endYear: null, error: `${label} does not look right.` };
    }
  }
  if (s !== null && e !== null && e < s) {
    return { startYear: null, endYear: null, error: "The end year is before the start year." };
  }
  return { startYear: s, endYear: e };
}

/** A DM, because an invitation the artist never sees is not consent. */
async function notifyArtist(caller: Caller, artistId: string, rosterId: string) {
  const admin = createAdminClient();
  const claim =
    caller.relationship === "represented"
      ? `${caller.name} would like to list you as a represented artist`
      : `${caller.name} would like to list you as a past participant`;

  const [a, b] = [caller.id, artistId].sort();
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  let convId = (existing as { id: string } | null)?.id;
  if (!convId) {
    const { data: created } = await admin
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();
    convId = (created as { id: string } | null)?.id;
  }
  if (!convId) return;

  await admin.from("messages").insert({
    conversation_id: convId,
    sender_id: caller.id,
    content: `${claim} on their Patronage page. Nothing appears until you accept, in your collectives settings.`,
    is_read: false,
    message_type: "text",
    is_system_message: true,
    metadata: { collective_id: rosterId },
  });
}

export async function updateRosterYears(
  membershipId: string,
  startYear: number | null,
  endYear: number | null
): Promise<{ error?: string }> {
  const { caller, error } = await requireRosterOrg();
  if (!caller) return { error };

  const years = normaliseYears(startYear, endYear);
  if (years.error) return { error: years.error };

  const admin = createAdminClient();

  // Scope the write to a membership of this organisation's own roster. Without
  // the subquery, an id from anywhere would be editable.
  const { data: roster } = await admin
    .from("collectives")
    .select("id")
    .eq("org_profile_id", caller.id)
    .limit(1)
    .maybeSingle();

  const rosterId = (roster as { id: string } | null)?.id;
  if (!rosterId) return { error: "No roster to edit." };

  const { error: updateError } = await admin
    .from("collective_members")
    .update({ start_year: years.startYear, end_year: years.endYear })
    .eq("id", membershipId)
    .eq("collective_id", rosterId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/partner/roster");
  return {};
}

export async function removeFromRoster(membershipId: string): Promise<{ error?: string }> {
  const { caller, error } = await requireRosterOrg();
  if (!caller) return { error };

  const admin = createAdminClient();
  const { data: roster } = await admin
    .from("collectives")
    .select("id")
    .eq("org_profile_id", caller.id)
    .limit(1)
    .maybeSingle();

  const rosterId = (roster as { id: string } | null)?.id;
  if (!rosterId) return { error: "No roster to edit." };

  const { error: deleteError } = await admin
    .from("collective_members")
    .delete()
    .eq("id", membershipId)
    .eq("collective_id", rosterId);

  if (deleteError) return { error: deleteError.message };

  revalidatePath("/partner/roster");
  return {};
}

/** Type-to-search for the add form. Artists only, and never the caller. */
export async function searchArtists(
  query: string
): Promise<Array<{ id: string; username: string; full_name: string | null; avatar_url: string | null; city: string | null }>> {
  const { caller } = await requireRosterOrg();
  if (!caller) return [];

  const q = query.trim();
  if (q.length < 2) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, username, full_name, avatar_url, city")
    .in("role", ["artist", "owner"])
    .eq("is_active", true)
    .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(8);

  return (data ?? []) as Array<{
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    city: string | null;
  }>;
}

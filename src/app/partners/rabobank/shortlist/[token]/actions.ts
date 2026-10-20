"use server";

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { windowState } from "@/lib/rabobank/time";
import { REACTIONS } from "@/lib/rabobank/shortlist";

const RESPONDENT = /^[A-Za-z0-9-]{16,64}$/;

export interface ReactionInput {
  token: string;
  artistId: string;
  respondentId: string;
  firstName: string;
  reaction: string;
  comment: string;
}

export type ReactionResult = { ok: true } | { ok: false; error: string };

export async function saveReaction(input: ReactionInput): Promise<ReactionResult> {
  if (!(await verifyToken(String(input.token ?? ""), "staff"))) {
    return { ok: false, error: "This link is no longer active." };
  }
  if (!RESPONDENT.test(input.respondentId ?? "")) return { ok: false, error: "Something went wrong. Please reload the page." };
  if (!REACTIONS.some((r) => r.key === input.reaction)) return { ok: false, error: "Choose one of the options." };

  const settings = await getSettings();
  if (windowState(settings.shortlist_open_at, settings.shortlist_close_at) !== "open") {
    return { ok: false, error: "Responses are closed." };
  }

  const ip = await getClientIp();
  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "rabobank")
    .update(ip)
    .digest("hex")
    .slice(0, 24);
  if (!(await checkRateLimit(`rabobank_reaction:${key}`, 120, 3600))) {
    return { ok: false, error: "Too many responses from this connection. Please try again later." };
  }

  const firstName = (input.firstName ?? "").trim().slice(0, 60) || null;
  if (settings.collect_first_name === "required" && !firstName) {
    return { ok: false, error: "Please add your first name above first." };
  }

  const admin = createAdminClient();
  const { data: artist } = await admin
    .from("rabobank_artist")
    .select("id")
    .eq("id", String(input.artistId))
    .eq("visible", true)
    .maybeSingle();
  if (!artist) return { ok: false, error: "That artist is no longer on the shortlist." };

  const { error } = await admin.from("rabobank_reaction").upsert(
    {
      artist_id: artist.id,
      respondent_id: input.respondentId,
      first_name: settings.collect_first_name === "off" ? null : firstName,
      reaction: input.reaction,
      comment: (input.comment ?? "").trim().slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "artist_id,respondent_id" }
  );
  if (error) {
    console.error("rabobank reaction upsert failed:", error.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}

/** A device reads back only its own reactions, so it can show what it chose. */
export async function loadMyReactions(
  token: string,
  respondentId: string
): Promise<{ artist_id: string; reaction: string; comment: string | null }[]> {
  if (!(await verifyToken(String(token ?? ""), "staff"))) return [];
  if (!RESPONDENT.test(respondentId ?? "")) return [];
  const { data } = await createAdminClient()
    .from("rabobank_reaction")
    .select("artist_id, reaction, comment")
    .eq("respondent_id", respondentId);
  return data ?? [];
}

"use server";

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { windowState } from "@/lib/rabobank/time";
import { ART_RELATION, LIMITS, MAX_ROOM_WANTS, NOTHING_IN_PARTICULAR, ROOM_WANTS } from "@/lib/rabobank/survey";

export interface SurveyInput {
  token: string;
  firstName: string;
  artRelation: string;
  artNote: string;
  story: string;
  place: string;
  cooperation: string;
  roomWants: string[];
  wrong: string;
  memory: string;
  artist: string;
  completionSeconds: number;
  [HONEYPOT_FIELD]?: string;
}

export type SurveyResult = { ok: true } | { ok: false; error: string };

const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};

export async function submitSurvey(input: SurveyInput): Promise<SurveyResult> {
  // Bots that fill the honeypot get a success message and nothing is stored.
  if (input[HONEYPOT_FIELD]) return { ok: true };

  if (!(await verifyToken(String(input.token ?? ""), "survey"))) {
    return { ok: false, error: "This link is no longer active." };
  }

  const settings = await getSettings();
  if (windowState(settings.survey_open_at, settings.survey_close_at) !== "open") {
    return { ok: false, error: "This survey is closed." };
  }

  // The IP is only used to build a rate-limit key, and it is keyed-hashed first
  // so the rate_limits table never holds an address.
  const ip = await getClientIp();
  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "rabobank")
    .update(ip)
    .digest("hex")
    .slice(0, 24);
  if (!(await checkRateLimit(`rabobank_survey:${key}`, 10, 3600))) {
    return { ok: false, error: "Too many submissions from this connection. Please try again later." };
  }

  const firstName = clean(input.firstName, LIMITS.firstName);
  if (settings.collect_first_name === "required" && !firstName) {
    return { ok: false, error: "Please add your first name." };
  }

  const wants = Array.isArray(input.roomWants)
    ? [...new Set(input.roomWants.filter((w): w is string => (ROOM_WANTS as readonly string[]).includes(w)))]
    : [];
  const roomWants = (wants.includes(NOTHING_IN_PARTICULAR) ? [NOTHING_IN_PARTICULAR] : wants).slice(0, MAX_ROOM_WANTS);
  const artRelation = (ART_RELATION as readonly string[]).includes(input.artRelation) ? input.artRelation : null;
  const seconds = Number.isFinite(input.completionSeconds)
    ? Math.min(Math.max(Math.round(input.completionSeconds), 0), 86_400)
    : null;

  const { error } = await createAdminClient()
    .from("rabobank_survey_response")
    .insert({
      first_name: settings.collect_first_name === "off" ? null : firstName,
      art_relation: artRelation,
      art_relation_note: clean(input.artNote, LIMITS.artNote),
      story_together: clean(input.story, LIMITS.story),
      story_place: clean(input.place, LIMITS.story),
      story_cooperation: clean(input.cooperation, LIMITS.story),
      room_wants: roomWants,
      feels_wrong: clean(input.wrong, LIMITS.wrong),
      memorable_artwork: clean(input.memory, LIMITS.memory),
      local_artist: clean(input.artist, LIMITS.artist),
      completion_seconds: seconds,
    });

  if (error) {
    console.error("rabobank survey insert failed:", error.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}

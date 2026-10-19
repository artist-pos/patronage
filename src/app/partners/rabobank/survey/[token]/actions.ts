"use server";

import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { windowState } from "@/lib/rabobank/time";
import { MOODS } from "@/lib/rabobank/survey";

export interface SurveyInput {
  token: string;
  firstName: string;
  q1: string;
  q2: string[];
  q2Other: string;
  q3: string;
  q4: string;
  q5: "yes" | "no" | "";
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
  const state = windowState(settings.survey_open_at, settings.survey_close_at);
  if (state !== "open") {
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

  const firstName = clean(input.firstName, 60);
  if (settings.collect_first_name === "required" && !firstName) {
    return { ok: false, error: "Please add your first name." };
  }

  const q2 = Array.isArray(input.q2)
    ? [...new Set(input.q2.filter((m): m is string => MOODS.includes(m as (typeof MOODS)[number])))].slice(0, 2)
    : [];
  const seconds = Number.isFinite(input.completionSeconds)
    ? Math.min(Math.max(Math.round(input.completionSeconds), 0), 86_400)
    : null;

  const { error } = await createAdminClient()
    .from("rabobank_survey_response")
    .insert({
      first_name: settings.collect_first_name === "off" ? null : firstName,
      q1: clean(input.q1, 300),
      q2,
      q2_other: q2.includes("Other") ? clean(input.q2Other, 100) : null,
      q3: clean(input.q3, 500),
      q4: clean(input.q4, 500),
      q5: input.q5 === "yes" ? true : input.q5 === "no" ? false : null,
      completion_seconds: seconds,
    });

  if (error) {
    console.error("rabobank survey insert failed:", error.message);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  return { ok: true };
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { sendBugReport } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { isSubmittedTooFast } from "@/lib/form-timing";
import { isTorExit } from "@/lib/bot-guard";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";
import { AREAS } from "./areas";

export type ReportBugState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function reportBugAction(
  _prev: ReportBugState,
  formData: FormData
): Promise<ReportBugState> {
  // Bots that blindly fill every field trip the honeypot — pretend success
  // so they don't retry with a cleaner payload. Same treatment for a
  // submission that arrived faster than a human could fill the form.
  if (
    (formData.get(HONEYPOT_FIELD) as string)?.trim() ||
    isSubmittedTooFast(formData.get("loadedAt"))
  ) {
    return { status: "success" };
  }

  const area = (formData.get("area") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const pageUrl = (formData.get("pageUrl") as string)?.trim() || undefined;
  let email = (formData.get("email") as string)?.trim().toLowerCase();

  const ip = await getClientIp();
  if (await isTorExit(ip)) return { status: "success" };
  if (!(await checkRateLimit(`bug-report:${ip}`, 5, 3600))) {
    return { status: "error", message: "Too many reports from this network. Please try again later." };
  }
  const turnstileToken = (formData.get("cf-turnstile-response") as string) || undefined;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { status: "error", message: "Verification failed. Please refresh and try again." };
  }

  if (!message || message.length < 10) {
    return {
      status: "error",
      message: "Please describe the bug in a little more detail.",
    };
  }
  if (!area || !AREAS.includes(area as (typeof AREAS)[number])) {
    return { status: "error", message: "Please choose an area." };
  }

  // Prefer the signed-in user's email; fall back to the one they typed.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email) email = user.email;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  try {
    await sendBugReport({
      email,
      area,
      message,
      pageUrl,
      userId: user?.id,
    });
  } catch {
    return {
      status: "error",
      message: "Couldn't send your report just now. Please try again.",
    };
  }

  return { status: "success" };
}

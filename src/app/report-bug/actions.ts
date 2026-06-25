"use server";

import { createClient } from "@/lib/supabase/server";
import { sendBugReport } from "@/lib/email";
import { AREAS } from "./areas";

export type ReportBugState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function reportBugAction(
  _prev: ReportBugState,
  formData: FormData
): Promise<ReportBugState> {
  const area = (formData.get("area") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();
  const pageUrl = (formData.get("pageUrl") as string)?.trim() || undefined;
  let email = (formData.get("email") as string)?.trim().toLowerCase();

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

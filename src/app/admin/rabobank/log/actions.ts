"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGES } from "@/lib/rabobank/log";

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorised.");
}

export async function addLogEntry(fd: FormData): Promise<void> {
  await requireAdmin();
  const stage = String(fd.get("stage"));
  const minutes = Math.round(Number(fd.get("minutes")));
  if (!STAGES.includes(stage as (typeof STAGES)[number]) || !Number.isFinite(minutes) || minutes < 0 || minutes > 5000) return;
  const date = String(fd.get("occurred_on") ?? "");
  await createAdminClient().from("rabobank_event_log").insert({
    stage,
    minutes,
    note: String(fd.get("note") ?? "").trim().slice(0, 1000) || null,
    ...(/^\d{4}-\d{2}-\d{2}$/.test(date) && { occurred_on: date }),
  });
  revalidatePath("/admin/rabobank/log");
}

export async function deleteLogEntry(fd: FormData): Promise<void> {
  await requireAdmin();
  await createAdminClient().from("rabobank_event_log").delete().eq("id", String(fd.get("id")));
  revalidatePath("/admin/rabobank/log");
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) throw new Error("Not authorised");
}

export async function approveOpportunity(id: string) {
  await guard();
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({ status: "published", is_active: true })
    .eq("id", id);
  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
}

export async function rejectOpportunity(id: string) {
  await guard();
  const admin = createAdminClient();
  await admin.from("opportunities").delete().eq("id", id);
  revalidatePath("/admin/opportunities/queue");
}

export async function approveAll(ids: string[]) {
  await guard();
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({ status: "published", is_active: true })
    .in("id", ids);
  revalidatePath("/admin/opportunities/queue");
  revalidatePath("/opportunities");
}

export async function rejectAll(ids: string[]) {
  await guard();
  const admin = createAdminClient();
  await admin.from("opportunities").delete().in("id", ids);
  revalidatePath("/admin/opportunities/queue");
}

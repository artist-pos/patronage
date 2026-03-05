import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("opportunities")
    .select("view_count")
    .eq("id", id)
    .single();

  if (data) {
    await admin
      .from("opportunities")
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}

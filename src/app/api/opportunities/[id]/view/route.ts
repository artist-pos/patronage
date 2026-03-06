import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;

  const { data } = await supabase
    .from("opportunities")
    .select("view_count")
    .eq("id", id)
    .maybeSingle();

  if (data) {
    await supabase
      .from("opportunities")
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}

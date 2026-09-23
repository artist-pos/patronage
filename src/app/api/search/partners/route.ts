import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerUser } from "@/lib/supabase/get-server-user";

// Partner-account picker for the listing form's "@" organiser field. Signed-in
// only: it exists to link a listing you are editing, not to enumerate orgs.
export async function GET(req: NextRequest) {
  const { user } = await getServerUser();
  if (!user) return NextResponse.json({ partners: [] }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const q = raw.replace(/^@/, "").replace(/[%_,()]/g, " ").trim();

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("role", "partner")
    .eq("is_active", true)
    .order("full_name", { ascending: true, nullsFirst: false })
    .limit(8);
  if (q.length > 0) query = query.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`);

  const { data } = await query;
  const partners = (data ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    name: p.full_name?.trim() || p.username,
    avatar_url: p.avatar_url,
  }));
  return NextResponse.json({ partners });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanSearchTerm, searchOpportunityRows, searchPartners } from "@/lib/search";

export async function GET(req: NextRequest) {
  // Leading "@" is tolerated so "@username" searches the same as "username".
  const q = cleanSearchTerm(req.nextUrl.searchParams.get("q") ?? "");
  if (q.length < 2) return NextResponse.json({ opportunities: [], artists: [], partners: [] });

  const supabase = await createClient();
  const p = `%${q}%`;

  const [opportunities, partners, { data: artists }] = await Promise.all([
    searchOpportunityRows(supabase, q, 6),
    searchPartners(supabase, q, 3),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, medium, country, career_stage")
      .in("role", ["artist", "owner"])
      .eq("is_active", true)
      .or(`full_name.ilike.${p},username.ilike.${p},bio.ilike.${p}`)
      .limit(5),
  ]);

  return NextResponse.json({ opportunities, partners, artists: artists ?? [] });
}

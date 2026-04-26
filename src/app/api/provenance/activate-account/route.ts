import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorised", { status: 401 });

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ account_status: "active" })
    .eq("id", user.id)
    .eq("account_status", "shadow"); // only update if currently shadow

  return new NextResponse(null, { status: 204 });
}

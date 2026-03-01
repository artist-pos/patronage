import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  if (error) return new NextResponse(error.message, { status: 500 });

  const rows = data ?? [];
  const csv = [
    "email,subscribed_at",
    ...rows.map((r) => `${r.email},${r.created_at}`),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="patronage-subscribers-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}

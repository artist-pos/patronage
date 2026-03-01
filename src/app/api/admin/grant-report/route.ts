import { NextRequest, NextResponse } from "next/server";
import { isAdmin, getGrantReport } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const report = await getGrantReport(id);
  return NextResponse.json({ report });
}

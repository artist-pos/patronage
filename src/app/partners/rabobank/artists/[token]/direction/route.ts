import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { getInviteByToken } from "@/lib/rabobank/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The creative direction PDF, only through a valid artist link. It lives in a
 * private bucket, is never publicly linkable, is served under a generic name,
 * and the first open is recorded for Blake.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);
  if (!invite) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });

  const settings = await getSettings();
  if (!settings.direction_pdf_path) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("rabobank-private").download(settings.direction_pdf_path);
  if (error || !data) return new NextResponse("Not available", { status: 503 });

  if (!invite.direction_opened_at) {
    await admin.from("rabobank_artist_invite").update({ direction_opened_at: new Date().toISOString() }).eq("id", invite.id);
  }

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="creative-direction.pdf"',
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

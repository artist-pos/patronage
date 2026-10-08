import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendPartnerApplicationSummary } from "@/lib/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/**
 * Daily: tell each organiser how many applications arrived since the last summary.
 * One email per opportunity per day, and only on days there is something to say.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const results = { opportunities: 0, emailed: 0, errors: [] as string[] };

  const { data: opps, error } = await admin
    .from("opportunities")
    .select("id, title, profile_id, applications_digest_at")
    .eq("routing_type", "pipeline")
    .eq("status", "published");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  for (const opp of opps ?? []) {
    const since = (opp.applications_digest_at as string | null) ?? new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    const [{ count: fresh }, { count: total }] = await Promise.all([
      admin.from("opportunity_applications").select("id", { count: "exact", head: true }).eq("opportunity_id", opp.id).gt("created_at", since),
      admin.from("opportunity_applications").select("id", { count: "exact", head: true }).eq("opportunity_id", opp.id),
    ]);
    if (!fresh || fresh === 0 || !opp.profile_id) continue;
    results.opportunities++;

    try {
      const { data: auth } = await admin.auth.admin.getUserById(opp.profile_id as string);
      const email = auth?.user?.email;
      const url = `${SITE_URL}/partner/dashboard/${opp.id}`;
      if (email) {
        await sendPartnerApplicationSummary({
          partnerEmail: email,
          opportunityTitle: opp.title as string,
          count: fresh,
          total: total ?? fresh,
          dashboardUrl: url,
        });
        results.emailed++;
      }
      await createNotification(
        opp.profile_id as string,
        "note",
        `${fresh} new application${fresh === 1 ? "" : "s"} for ${opp.title}`,
        null,
        `/partner/dashboard/${opp.id}`,
      );
      await admin.from("opportunities").update({ applications_digest_at: now.toISOString() }).eq("id", opp.id);
    } catch (err) {
      results.errors.push(`${opp.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

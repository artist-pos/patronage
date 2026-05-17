export const dynamic = "force-dynamic";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Follow-ups — Admin — Patronage" };

interface FollowupRow {
  id: string;
  profile_id: string;
  opportunity_id: string;
  application_id: string;
  followup_type: string;
  sent_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export default async function AdminFollowupsPage() {
  const admin = createAdminClient();

  const { data: followups } = await admin
    .from("artist_followups")
    .select("id, profile_id, opportunity_id, application_id, followup_type, sent_at, completed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (followups ?? []) as FollowupRow[];

  // Collect unique IDs for enrichment
  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const oppIds = [...new Set(rows.map((r) => r.opportunity_id))];

  const [{ data: profiles }, { data: opps }] = await Promise.all([
    profileIds.length > 0
      ? admin.from("profiles").select("id, username, full_name").in("id", profileIds)
      : { data: [] },
    oppIds.length > 0
      ? admin.from("opportunities").select("id, title").in("id", oppIds)
      : { data: [] },
  ]);

  const profileMap = new Map<string, { username: string; full_name: string | null }>();
  for (const p of (profiles ?? []) as { id: string; username: string; full_name: string | null }[]) {
    profileMap.set(p.id, p);
  }
  const oppMap = new Map<string, string>();
  for (const o of (opps ?? []) as { id: string; title: string }[]) {
    oppMap.set(o.id, o.title);
  }

  const pending = rows.filter((r) => !r.completed_at && !r.sent_at);
  const sent = rows.filter((r) => r.sent_at && !r.completed_at);
  const completed = rows.filter((r) => r.completed_at);

  const triggerCron = async () => {
    "use server";
    // Manual trigger handled via API call — link provided in UI
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Artist Follow-ups</h1>
          <p className="text-xs text-muted-foreground">
            {rows.length} total · {pending.length} pending · {sent.length} awaiting response · {completed.length} completed
          </p>
        </div>
        <a
          href="/api/cron/send-followups"
          target="_blank"
          className="shrink-0 text-xs border border-black px-3 py-1.5 hover:bg-muted transition-colors"
        >
          Run cron manually ↗
        </a>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          No follow-ups yet. They are scheduled automatically when artists are selected for pipeline opportunities.
        </p>
      ) : (
        <div className="border border-black overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/20 bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Artist</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden sm:table-cell">Opportunity</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">Sent</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">Completed</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const profile = profileMap.get(r.profile_id);
                const oppTitle = oppMap.get(r.opportunity_id) ?? "—";
                const name = profile?.full_name ?? profile?.username ?? r.profile_id.slice(0, 8);
                const status = r.completed_at ? "Completed" : r.sent_at ? "Awaiting response" : "Pending";
                const statusColour = r.completed_at
                  ? "text-green-700"
                  : r.sent_at
                  ? "text-yellow-700"
                  : "text-muted-foreground";

                return (
                  <tr key={r.id} className="border-b border-black/10 last:border-0">
                    <td className="py-2.5 px-3 font-medium">
                      {profile ? (
                        <Link href={`/${profile.username}`} className="hover:underline" target="_blank">
                          {name}
                        </Link>
                      ) : name}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell max-w-[200px] truncate">
                      {oppTitle}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {r.followup_type === "12_month" ? "12-month" : "6-month"}
                    </td>
                    <td className={`py-2.5 px-3 ${statusColour}`}>{status}</td>
                    <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell">
                      {r.sent_at ? new Date(r.sent_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell">
                      {r.completed_at ? new Date(r.completed_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {r.completed_at ? null : (
                        <a
                          href={`/followup/${r.id}`}
                          target="_blank"
                          className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
                        >
                          Form ↗
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

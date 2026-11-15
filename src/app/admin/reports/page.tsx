export const dynamic = "force-dynamic";
import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportButtons } from "./ReportButtons";

export const metadata: Metadata = { title: "Reports — Admin" };

interface Report {
  id: string;
  item_type: "note" | "notice" | "notice_reply";
  item_id: string;
  created_at: string;
}

const TYPE_LABEL: Record<Report["item_type"], string> = {
  note: "Note on an update",
  notice: "Notice",
  notice_reply: "Reply on a notice",
};

/**
 * Open reports on notes, notices and notice replies (227), oldest first, one
 * row per item however many people reported it.
 */
export default async function AdminReportsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_reports")
    .select("id, item_type, item_id, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .limit(300);

  // One row per item, with how many people reported it (admin-only number).
  const byItem = new Map<string, { report: Report; reporters: number }>();
  for (const r of (data ?? []) as Report[]) {
    const key = `${r.item_type}:${r.item_id}`;
    const seen = byItem.get(key);
    if (seen) seen.reporters += 1;
    else byItem.set(key, { report: r, reporters: 1 });
  }
  const rows = [...byItem.values()];

  const ids = (t: Report["item_type"]) => rows.filter((r) => r.report.item_type === t).map((r) => r.report.item_id);
  const [notes, notices, replies] = await Promise.all([
    ids("note").length ? admin.from("project_notes").select("id, content, update_id").in("id", ids("note")).then((r) => r.data ?? []) : [],
    ids("notice").length ? admin.from("notices").select("id, body").in("id", ids("notice")).then((r) => r.data ?? []) : [],
    ids("notice_reply").length ? admin.from("notice_replies").select("id, body, notice_id").in("id", ids("notice_reply")).then((r) => r.data ?? []) : [],
  ]);
  const text = new Map<string, { body: string; href: string }>();
  for (const n of notes as { id: string; content: string; update_id: string }[]) text.set(n.id, { body: n.content, href: `/projects/${n.update_id}#notes` });
  for (const n of notices as { id: string; body: string }[]) text.set(n.id, { body: n.body, href: `/noticeboard/${n.id}` });
  for (const n of replies as { id: string; body: string; notice_id: string }[]) text.set(n.id, { body: n.body, href: `/noticeboard/${n.notice_id}` });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Reports ({rows.length})</h1>
        <p className="text-sm text-muted-foreground">
          Notes, notices and replies people have reported. Hide anything abusive, spam or unsafe; keep anything that&rsquo;s
          only a disagreement.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing reported.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map(({ report, reporters }) => {
            const item = text.get(report.item_id);
            return (
              <li key={report.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0 max-w-[720px] space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABEL[report.item_type]} · {reporters} {reporters === 1 ? "report" : "reports"} ·{" "}
                    {new Date(report.created_at).toLocaleDateString("en-NZ")}
                    {item && (
                      <>
                        {" · "}
                        <Link href={item.href} className="underline underline-offset-2">Open</Link>
                      </>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{item?.body ?? "Already deleted."}</p>
                </div>
                <ReportButtons reportId={report.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { STAGES } from "@/lib/rabobank/log";
import { addLogEntry, deleteLogEntry } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rabobank event log", robots: { index: false, follow: false } };

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default async function LogAdmin() {
  const { data } = await createAdminClient()
    .from("rabobank_event_log")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  const totals = STAGES.map((s) => ({ stage: s, minutes: rows.filter((r) => r.stage === s).reduce((n, r) => n + r.minutes, 0) }));
  const all = totals.reduce((n, t) => n + t.minutes, 0);
  const hours = (m: number) => (m / 60).toFixed(1);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Event log</h1>
        <Link href="/admin/rabobank/log/export" prefetch={false} className="text-sm underline">Export CSV</Link>
      </div>

      <form action={addLogEntry} className="grid gap-3 sm:grid-cols-5">
        <select name="stage" className={input} aria-label="Stage" defaultValue="survey">
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input name="minutes" type="number" min={0} max={5000} placeholder="Minutes" aria-label="Minutes" className={input} required />
        <input name="occurred_on" type="date" aria-label="Date" className={input} />
        <input name="note" placeholder="Note" aria-label="Note" className={`${input} sm:col-span-1`} maxLength={1000} />
        <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Add entry</button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Hours by stage</h2>
        <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          {totals.map((t) => (
            <li key={t.stage} className="flex justify-between border-b border-border py-1">
              <span>{t.stage}</span><span>{hours(t.minutes)} h</span>
            </li>
          ))}
          <li className="flex justify-between py-1 font-semibold"><span>Total</span><span>{hours(all)} h</span></li>
        </ul>
      </section>

      <section className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr><th className="py-2 pr-4">Date</th><th className="pr-4">Stage</th><th className="pr-4">Minutes</th><th className="pr-4">Note</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{r.occurred_on}</td>
                <td className="pr-4">{r.stage}</td>
                <td className="pr-4">{r.minutes}</td>
                <td className="pr-4">{r.note}</td>
                <td><form action={deleteLogEntry}><input type="hidden" name="id" value={r.id} /><button className="text-xs underline">Delete</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

import Link from "next/link";
import { formatNz, utcToNzLocalInput, windowState } from "@/lib/rabobank/time";
import { ART_RELATION, ROOM_WANTS } from "@/lib/rabobank/survey";
import type { RabobankSettings } from "@/lib/rabobank/settings";
import { revokeToken } from "./actions";
import { DeleteNamesButton, DeleteTokenButton, ScheduleForm, TokenForm } from "./Forms";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from Supabase */
export interface DashboardData {
  settings: RabobankSettings;
  tokens: any[];
  rows: any[];
}

const heading = "text-xs font-medium uppercase tracking-widest text-stone-400";
const LINK_NAMES: Record<string, string> = { survey: "Survey", staff: "Staff shortlist", client: "Client" };

const short = (iso: string) => formatNz(iso, { weekday: undefined, month: "short", hour: undefined, minute: undefined });

function windowStatus(open: string | null, close: string | null): string {
  if (!open && !close) return "Not scheduled";
  const s = windowState(open, close);
  if (s === "before") return `Opens ${short(open!)}`;
  if (s === "closed") return "Closed";
  return close ? `Open · closes ${short(close)}` : "Open";
}

const secs = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

function Bars({ items, total, highlight = 0 }: { items: (readonly [string, number])[]; total: number; highlight?: number }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  return (
    <ul className="space-y-2.5">
      {items.map(([label, n], i) => (
        <li key={label} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span className={i < highlight && n > 0 ? "font-medium" : "text-stone-600"}>{label}</span>
            <span className="tabular-nums text-stone-500">{n}{total ? ` · ${Math.round((n / total) * 100)}%` : ""}</span>
          </div>
          <div className="h-1.5 rounded-full bg-stone-100">
            <div className={`h-full rounded-full ${i < highlight && n > 0 ? "bg-black" : "bg-stone-400"}`} style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Dashboard({ settings, tokens, rows }: DashboardData) {
  const times = rows.map((r) => r.completion_seconds).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : null;
  const relationCounts = ART_RELATION.map((o) => [o, rows.filter((r) => r.art_relation === o).length] as const);
  const wantCounts = ROOM_WANTS.map((o) => [o, rows.filter((r) => (r.room_wants ?? []).includes(o)).length] as const)
    .sort((a, b) => b[1] - a[1]);
  const surveyStatus = windowStatus(settings.survey_open_at, settings.survey_close_at);
  const shortlistStatus = windowStatus(settings.shortlist_open_at, settings.shortlist_close_at);
  const now = new Date();
  const live = tokens.filter((t) => !t.revoked && !(t.expires_at && new Date(t.expires_at) <= now));
  const dead = tokens.filter((t) => !live.includes(t));

  return (
    <div className="space-y-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Rabobank Te Puke pilot</h1>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">Survey: {surveyStatus}</span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">Shortlist: {shortlistStatus}</span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-600">{rows.length} {rows.length === 1 ? "response" : "responses"}</span>
        </div>
      </header>

      <section className="space-y-4">
        <h2 className={heading}>Schedule</h2>
        <ScheduleForm
          status={{ survey: surveyStatus, shortlist: shortlistStatus }}
          values={{
            survey_open_at: utcToNzLocalInput(settings.survey_open_at),
            survey_close_at: utcToNzLocalInput(settings.survey_close_at),
            shortlist_open_at: utcToNzLocalInput(settings.shortlist_open_at),
            shortlist_close_at: utcToNzLocalInput(settings.shortlist_close_at),
            collect_first_name: settings.collect_first_name,
            shortlist_intro: settings.shortlist_intro ?? "",
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className={heading}>Links</h2>
        <TokenForm />
        {tokens.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-xs text-stone-500">
                <tr><th className="px-4 py-2 font-medium">Link</th><th className="px-4 font-medium">Label</th><th className="px-4 font-medium">Created</th><th className="px-4 text-right font-medium" /></tr>
              </thead>
              <tbody>
                {[...live, ...dead].map((t) => {
                  const isLive = live.includes(t);
                  return (
                    <tr key={t.id} className={`border-t border-border ${isLive ? "" : "text-stone-400"}`}>
                      <td className="px-4 py-2.5">{LINK_NAMES[t.type] ?? t.type}</td>
                      <td className="px-4">{t.label ?? "—"}</td>
                      <td className="px-4">{formatNz(t.created_at, { weekday: undefined, month: "short" })}</td>
                      <td className="px-4 text-right">
                        <span className="inline-flex items-center gap-3">
                          {isLive ? (
                            <form action={revokeToken} className="inline">
                              <input type="hidden" name="id" value={t.id} />
                              <button className="text-xs text-stone-500 underline underline-offset-4 hover:text-destructive">Revoke</button>
                            </form>
                          ) : (
                            <span className="text-xs">{t.revoked ? "Revoked" : "Expired"}</span>
                          )}
                          <DeleteTokenButton id={t.id} live={isLive} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={heading}>Survey results</h2>
          <Link href="/admin/rabobank/export" prefetch={false} className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:bg-stone-50">Export CSV</Link>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {([
            ["Responses", String(rows.length)],
            ["Median time", median !== null ? secs(median) : "–"],
            ["Named", rows.length ? `${rows.filter((r) => r.first_name).length} of ${rows.length}` : "–"],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-white p-4">
              <dt className="text-xs text-stone-500">{k}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="mb-4 font-medium">Relationship with art</h3>
            <Bars items={relationCounts} total={rows.length} />
          </div>
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="mb-4 font-medium">What the artwork should be doing <span className="font-normal text-stone-500">· top three in black</span></h3>
            <Bars items={wantCounts} total={rows.length} highlight={3} />
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((r) => (
            <details key={r.id} className="group rounded-xl border border-border bg-white text-sm open:pb-2">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span>
                  <strong className="font-medium">{r.first_name ?? "No name"}</strong>
                  <span className="text-stone-500"> · {formatNz(r.created_at, { weekday: undefined, month: "short" })}{r.completion_seconds !== null && ` · ${secs(r.completion_seconds)}`}</span>
                </span>
                <span className="text-xs text-stone-400 group-open:hidden">Show</span>
                <span className="hidden text-xs text-stone-400 group-open:inline">Hide</span>
              </summary>
              <dl className="space-y-3 px-4 pb-2">
                {(
                  [
                    ["Relationship with art", [r.art_relation, r.art_relation_note].filter(Boolean).join(" — ")],
                    ["Working together", r.story_together],
                    ["Place", r.story_place],
                    ["Pulling together", r.story_cooperation],
                    ["What the artwork should do", (r.room_wants ?? []).join("; ")],
                    ["Would feel wrong", r.feels_wrong],
                    ["An artwork that stayed with them", r.memorable_artwork],
                    ["Local artist or maker", r.local_artist],
                    // First survey, kept so earlier responses still read.
                    ["Day to day (v1)", r.q1],
                    ["Feeling (v1)", [...(r.q2 ?? []), r.q2_other ? `(${r.q2_other})` : ""].filter(Boolean).join(", ")],
                    ["Subjects (v1)", r.q3],
                    ["Avoid (v1)", r.q4],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([label, v]) => (
                    <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-0.5">{v}</dd></div>
                  ))}
              </dl>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/30 p-5">
        <h2 className={heading}>Names</h2>
        <p className="text-sm text-stone-600">
          Removes every first name from survey answers and shortlist reactions, and keeps the answers.{" "}
          {settings.names_deleted_at && `Last done ${formatNz(settings.names_deleted_at, { weekday: undefined })}.`}
        </p>
        <DeleteNamesButton />
      </section>
    </div>
  );
}

import Link from "next/link";
import { ChevronDown, Download, Eye } from "lucide-react";
import { formatNz, utcToNzLocalInput, windowState } from "@/lib/rabobank/time";
import { ART_RELATION, ROOM_WANTS } from "@/lib/rabobank/survey";
import type { RabobankSettings } from "@/lib/rabobank/settings";
import { revokeToken } from "./actions";
import { DeleteNamesButton, DeleteResponseButton, DeleteTokenButton, SettingsPanel, TokenForm } from "./Forms";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from Supabase */
export interface DashboardData {
  settings: RabobankSettings;
  tokens: any[];
  rows: any[];
}

const sectionTitle = "text-xs font-medium uppercase tracking-widest text-stone-400";
const LINK_NAMES: Record<string, string> = { survey: "Survey", staff: "Staff shortlist", client: "Client" };

const short = (iso: string) => formatNz(iso, { weekday: undefined, month: "short", hour: undefined, minute: undefined });
const stamp = (iso: string) => formatNz(iso, { weekday: undefined, month: "short" });

function windowStatus(open: string | null, close: string | null): string {
  if (!open && !close) return "Not scheduled";
  const s = windowState(open, close);
  if (s === "before") return `Opens ${short(open!)}`;
  if (s === "closed") return "Closed";
  return close ? `Open until ${short(close)}` : "Open";
}

const secs = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

function Bars({ items, total, highlight = 0 }: { items: (readonly [string, number])[]; total: number; highlight?: number }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  return (
    <ul className="space-y-3">
      {items.map(([label, n], i) => {
        const top = i < highlight && n > 0;
        return (
          <li key={label} className="text-sm">
            <div className="mb-1 flex justify-between gap-3">
              <span className={top ? "font-medium" : "text-stone-600"}>{label}</span>
              <span className="shrink-0 tabular-nums text-stone-500">{n}{total ? <span className="text-stone-400"> · {Math.round((n / total) * 100)}%</span> : null}</span>
            </div>
            <div className="h-1 rounded-full bg-stone-100">
              <div className={`h-full rounded-full ${top ? "bg-black" : "bg-stone-300"}`} style={{ width: `${(n / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const answerRows = (r: any) =>
  (
    [
      ["Relationship with art", [r.art_relation, r.art_relation_note].filter(Boolean).join(" — ")],
      ["Working together", r.story_together],
      ["Place", r.story_place],
      ["Pulling together", r.story_cooperation],
      ["Local artist or maker", r.local_artist],
      ["The room in use", r.room_scene],
      ["What the artwork should do", (r.room_wants ?? []).join("; ")],
      ["Would feel wrong", r.feels_wrong],
      ["An artwork that stayed with them", r.memorable_artwork],
      // First survey, kept so earlier responses still read.
      ["Day to day (v1)", r.q1],
      ["Feeling (v1)", [...(r.q2 ?? []), r.q2_other ? `(${r.q2_other})` : ""].filter(Boolean).join(", ")],
      ["Subjects (v1)", r.q3],
      ["Avoid (v1)", r.q4],
    ] as const
  ).filter(([, v]) => v);

export function Dashboard({ settings, tokens, rows }: DashboardData) {
  const times = rows.map((r) => r.completion_seconds).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : null;
  const named = rows.filter((r) => r.first_name).length;
  const relationCounts = ART_RELATION.map((o) => [o, rows.filter((r) => r.art_relation === o).length] as const);
  const wantCounts = ROOM_WANTS.map((o) => [o, rows.filter((r) => (r.room_wants ?? []).includes(o)).length] as const)
    .sort((a, b) => b[1] - a[1]);
  const surveyStatus = windowStatus(settings.survey_open_at, settings.survey_close_at);
  const shortlistStatus = windowStatus(settings.shortlist_open_at, settings.shortlist_close_at);
  const now = new Date();
  const isLive = (t: any) => !t.revoked && !(t.expires_at && new Date(t.expires_at) <= now);
  const links = [...tokens.filter(isLive), ...tokens.filter((t) => !isLive(t))];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold">Rabobank Te Puke pilot</h1>
          <p className="mt-0.5 text-sm text-stone-500">Survey {surveyStatus.charAt(0).toLowerCase() + surveyStatus.slice(1)}</p>
        </div>
        <a
          href="/partners/rabobank/preview"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm hover:border-stone-400"
        >
          <Eye className="size-4" /> Preview survey
        </a>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------- results ---------- */}
        <div className="min-w-0 space-y-8">
          <dl className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-white">
            {([
              ["Responses", String(rows.length)],
              ["Median time", median !== null ? secs(median) : "–"],
              ["Gave a name", rows.length ? `${named} of ${rows.length}` : "–"],
            ] as const).map(([k, v]) => (
              <div key={k} className="px-5 py-4">
                <dt className="text-xs text-stone-500">{k}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid divide-y divide-border rounded-xl border border-border bg-white md:grid-cols-2 md:divide-x md:divide-y-0">
            <section className="p-5">
              <h2 className="mb-4 text-sm font-medium">Relationship with art</h2>
              <Bars items={relationCounts} total={rows.length} />
            </section>
            <section className="p-5">
              <h2 className="mb-4 text-sm font-medium">What the artwork should do <span className="font-normal text-stone-400">· top three in black</span></h2>
              <Bars items={wantCounts} total={rows.length} highlight={3} />
            </section>
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className={sectionTitle}>Responses</h2>
              {rows.length > 0 && (
                <Link href="/admin/rabobank/export" prefetch={false} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-foreground">
                  <Download className="size-4" /> Export CSV
                </Link>
              )}
            </div>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-stone-500">No responses yet.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
                {rows.map((r) => (
                  <li key={r.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-3 text-sm hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                        <span className="w-28 shrink-0 truncate font-medium">{r.first_name ?? <span className="font-normal text-stone-400">No name</span>}</span>
                        <span className="min-w-0 flex-1 truncate text-stone-500">{r.art_relation ?? r.story_place ?? ""}</span>
                        <span className="hidden shrink-0 tabular-nums text-stone-400 sm:inline">{stamp(r.created_at)}{r.completion_seconds !== null && ` · ${secs(r.completion_seconds)}`}</span>
                        <ChevronDown className="size-4 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-border bg-stone-50/60 px-5 py-4">
                        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
                          {answerRows(r).map(([label, v]) => (
                            <div key={label} className="contents">
                              <dt className="text-stone-500">{label}</dt>
                              <dd className="whitespace-pre-line">{v}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-stone-400">
                          <span className="sm:hidden">{stamp(r.created_at)}{r.completion_seconds !== null && ` · ${secs(r.completion_seconds)}`}</span>
                          <span className="ml-auto"><DeleteResponseButton id={r.id} who={r.first_name ?? "this"} /></span>
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------- setup ---------- */}
        <aside className="divide-y divide-border rounded-xl border border-border bg-white lg:sticky lg:top-6">
          <SettingsPanel
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

          <section className="space-y-3 p-5">
            <h2 className={sectionTitle}>Links</h2>
            <TokenForm />
            {links.length > 0 && (
              <ul className="-mx-1 divide-y divide-border">
                {links.map((t) => {
                  const live = isLive(t);
                  return (
                    <li key={t.id} className={`flex items-center gap-3 px-1 py-2 text-sm ${live ? "" : "text-stone-400"}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{LINK_NAMES[t.type] ?? t.type}{t.label ? <span className="text-stone-500"> · {t.label}</span> : null}</span>
                        <span className="block text-xs text-stone-400">{live ? `Made ${short(t.created_at)}` : t.revoked ? "Revoked" : "Expired"}</span>
                      </span>
                      {live && (
                        <form action={revokeToken}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="text-xs text-stone-500 underline-offset-4 hover:underline">Revoke</button>
                        </form>
                      )}
                      <DeleteTokenButton id={t.id} live={live} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-1.5 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className={sectionTitle}>Names</h2>
              <DeleteNamesButton />
            </div>
            <p className="text-xs text-stone-500">
              Clears every first name from answers and reactions; the answers stay.
              {settings.names_deleted_at && ` Last done ${short(settings.names_deleted_at)}.`}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

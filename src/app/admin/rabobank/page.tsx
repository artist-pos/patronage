import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNz, utcToNzLocalInput } from "@/lib/rabobank/time";
import { ART_RELATION, ROOM_WANTS } from "@/lib/rabobank/survey";
import { deleteAllNames, revokeToken } from "./actions";
import { SettingsForm, TokenForm } from "./Forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rabobank pilot", robots: { index: false, follow: false } };

const h2 = "text-lg font-semibold";

export default async function RabobankAdmin() {
  const admin = createAdminClient();
  const [settings, tokens, responses] = await Promise.all([
    getSettings(),
    admin.from("rabobank_access_token").select("*").order("created_at", { ascending: false }),
    admin.from("rabobank_survey_response").select("*").order("created_at", { ascending: false }),
  ]);
  const rows = responses.data ?? [];

  const times = rows.map((r) => r.completion_seconds).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : null;
  const mean = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const relationCounts = ART_RELATION.map((o) => [o, rows.filter((r) => r.art_relation === o).length] as const);
  const wantCounts = ROOM_WANTS.map((o) => [o, rows.filter((r) => (r.room_wants ?? []).includes(o)).length] as const);

  return (
    <div className="space-y-12">
      <h1 className="text-2xl font-semibold">Rabobank Te Puke pilot</h1>

      <section className="space-y-4">
        <h2 className={h2}>Dates and settings</h2>
        <SettingsForm
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
        <h2 className={h2}>Links</h2>
        <TokenForm />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2 pr-4">Type</th><th className="pr-4">Label</th><th className="pr-4">Created</th><th className="pr-4">Expires</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(tokens.data ?? []).map((t) => {
                const expired = t.expires_at && new Date(t.expires_at) <= new Date();
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="py-2 pr-4">{t.type}</td>
                    <td className="pr-4">{t.label ?? ""}</td>
                    <td className="pr-4">{formatNz(t.created_at, { weekday: undefined })}</td>
                    <td className="pr-4">{t.expires_at ? formatNz(t.expires_at, { weekday: undefined }) : "never"}</td>
                    <td>
                      {t.revoked ? "Revoked" : expired ? "Expired" : (
                        <form action={revokeToken} className="inline">
                          <input type="hidden" name="id" value={t.id} />
                          Active · <button className="underline">Revoke</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className={h2}>Survey results ({rows.length})</h2>
          <Link href="/admin/rabobank/export" prefetch={false} className="text-sm underline">Export CSV</Link>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Responses</dt><dd className="text-xl font-semibold">{rows.length}</dd></div>
          <div><dt className="text-muted-foreground">Median time</dt><dd className="text-xl font-semibold">{median !== null ? `${median}s` : "–"}</dd></div>
          <div><dt className="text-muted-foreground">Average time</dt><dd className="text-xl font-semibold">{mean !== null ? `${mean}s` : "–"}</dd></div>
        </dl>
        <div className="grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <h3 className="mb-1 font-medium">Relationship with art</h3>
            <ul className="space-y-0.5">{relationCounts.map(([o, n]) => <li key={o}>{n} · {o}</li>)}</ul>
          </div>
          <div>
            <h3 className="mb-1 font-medium">What the room should bring</h3>
            <ul className="space-y-0.5">{wantCounts.map(([o, n]) => <li key={o}>{n} · {o}</li>)}</ul>
          </div>
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-md border border-border p-4 text-sm">
              <p className="mb-2 text-xs text-muted-foreground">
                <strong className="text-foreground">{r.first_name ?? "No name"}</strong> · {formatNz(r.created_at, { weekday: undefined })}
                {r.completion_seconds !== null && ` · ${r.completion_seconds}s`}
              </p>
              <dl className="space-y-1">
                {(
                  [
                    ["Relationship with art", [r.art_relation, r.art_relation_note].filter(Boolean).join(" — ")],
                    ["Working together", r.story_together],
                    ["Place", r.story_place],
                    ["Cooperation", r.story_cooperation],
                    ["The room should bring", (r.room_wants ?? []).join("; ")],
                    ["Would feel wrong", r.feels_wrong],
                    ["A memorable artwork", r.memorable_artwork],
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
                    <div key={label}><dt className="inline text-muted-foreground">{label}: </dt><dd className="inline">{v}</dd></div>
                  ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={h2}>Names</h2>
        <p className="text-sm text-muted-foreground">
          Removes every first name from survey answers and shortlist reactions, and keeps the answers.{" "}
          {settings.names_deleted_at && `Last done ${formatNz(settings.names_deleted_at, { weekday: undefined })}.`}
        </p>
        <form action={deleteAllNames}>
          <button className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive">Delete all names</button>
        </form>
      </section>
    </div>
  );
}

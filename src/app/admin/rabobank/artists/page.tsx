import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { loadArtistAdmin } from "@/lib/rabobank/artist-admin";
import { formatNz, utcToNzLocalInput } from "@/lib/rabobank/time";
import { inviteLink } from "@/lib/rabobank/invites";
import { RETENTION_DAYS } from "@/lib/rabobank/retention";
import { adminDeleteProfile, deleteInvite, markInvited, saveNotes } from "./actions";
import { CloseSelection, ConfirmButton, CopyLinks, InviteForm, QuoteTable, SettingsForm, ShortlistToggle } from "./ArtistsAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rabobank artists", robots: { index: false, follow: false } };

const sectionTitle = "text-xs font-medium uppercase tracking-widest text-stone-400";
const STATUS = { not_started: "Not started", saved: "Saved", done: "Done" } as const;
const stamp = (iso: string | null) => (iso ? formatNz(iso, { weekday: undefined, month: "short" }) : "–");

export default async function RabobankArtistsAdmin() {
  const { rows, settings } = await loadArtistAdmin();
  const quoted = rows.filter((r) => r.quote?.status === "submitted" && r.quote.interested !== "no");
  const closedAt = settings.selection_closed_at;
  const deleteOn = closedAt ? new Date(new Date(closedAt).getTime() + RETENTION_DAYS * 864e5).toISOString() : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Invited artists</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {rows.length} invited · {rows.filter((r) => r.partOne === "done").length} quotes · {rows.filter((r) => r.partTwo === "done").length} profiles
          </p>
        </div>
        <Link href="/admin/rabobank/artists/export" prefetch={false} className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-foreground">
          <Download className="size-4" /> Export CSV
        </Link>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <section className="space-y-3">
            <h2 className={sectionTitle}>Invites</h2>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-stone-500">No invites yet. Create one on the right.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
                {rows.map((r) => (
                  <li key={r.invite.id}>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm hover:bg-stone-50 [&::-webkit-details-marker]:hidden">
                        <span className="w-40 truncate font-medium">{r.invite.full_name ?? r.invite.first_name}</span>
                        <span className="w-20 text-stone-500">{r.invite.channel === "instagram" ? "Instagram" : "Email"}</span>
                        <span className="w-28 text-stone-500">{r.invite.declined_at ? "Declined" : `One: ${STATUS[r.partOne]}`}</span>
                        <span className="w-28 text-stone-500">Two: {r.deletion ? "Deleted" : STATUS[r.partTwo]}</span>
                        <span className="hidden flex-1 text-right text-xs text-stone-400 sm:block">
                          {r.invite.opened_at ? `Opened ${stamp(r.invite.opened_at)}${r.invite.opened_source ? ` via ${r.invite.opened_source}` : ""}` : r.invite.invited_at ? `Sent ${stamp(r.invite.invited_at)}` : "Not sent"}
                          {r.invite.last_activity_at && ` · active ${stamp(r.invite.last_activity_at)}`}
                        </span>
                      </summary>
                      <div className="space-y-5 border-t border-border bg-stone-50/60 px-5 py-5">
                        <div className="flex flex-wrap items-center gap-3">
                          <CopyLinks email={inviteLink(r.invite.token, "email")} instagram={inviteLink(r.invite.token, "instagram")} />
                          {!r.invite.invited_at && (
                            <form action={markInvited}>
                              <input type="hidden" name="id" value={r.invite.id} />
                              <button className="text-xs text-stone-500 underline-offset-4 hover:underline">Mark as sent</button>
                            </form>
                          )}
                        </div>
                        <p className="text-xs text-stone-500">
                          Opens: {r.invite.opens_email} email · {r.invite.opens_instagram} Instagram · {r.invite.opens_other} other
                        </p>

                        {r.artist && (
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <ShortlistToggle artistId={r.artist.id} shortlisted={r.artist.visible} />
                            <span className="text-stone-500">
                              Profile: {r.artist.state ?? "draft"} · {r.artist.works} works · choice {r.artist.visibility_choice ?? "not made"}
                            </span>
                            <form action={adminDeleteProfile}>
                              <input type="hidden" name="artist_id" value={r.artist.id} />
                              <ConfirmButton message="Delete this artist's profile, photo and works for good? Their quote is kept.">Delete profile</ConfirmButton>
                            </form>
                          </div>
                        )}
                        {r.deletion && <p className="text-sm text-stone-500">Profile deleted {stamp(r.deletion.deleted_at)} ({r.deletion.reason.replace("_", " ")}).</p>}
                        {r.invite.decline_suggestion && <p className="text-sm"><span className="text-stone-500">Suggested: </span>{r.invite.decline_suggestion}</p>}

                        <form action={saveNotes} className="space-y-2">
                          <input type="hidden" name="id" value={r.invite.id} />
                          <label className="block text-sm font-medium" htmlFor={`notes-${r.invite.id}`}>Notes</label>
                          <textarea id={`notes-${r.invite.id}`} name="admin_notes" rows={2} defaultValue={r.invite.admin_notes ?? ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" />
                          <button className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:border-stone-400">Save notes</button>
                        </form>

                        <details>
                          <summary className="cursor-pointer text-sm font-medium">Edit invite</summary>
                          <div className="mt-3"><InviteForm invite={r.invite} /></div>
                        </details>
                        <form action={deleteInvite}>
                          <input type="hidden" name="id" value={r.invite.id} />
                          <ConfirmButton message="Delete this invite? The link stops working, and their quote and profile are deleted.">Delete invite</ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className={sectionTitle}>Quote comparison</h2>
            <p className="text-sm text-stone-500">
              Fees shown excluding GST. Indicative total = fee + framing (the artist&rsquo;s own figure if they frame it, otherwise your framer figure) + the artist&rsquo;s installation cost.
            </p>
            <QuoteTable
              rows={quoted.map((r) => ({
                id: r.invite.id,
                name: r.invite.full_name ?? r.invite.first_name,
                gst: r.quote.gst_inclusive === null ? "" : r.quote.gst_inclusive ? "entered incl. GST" : "entered excl. GST",
                framing: r.quote.framing_option,
                install: r.quote.install_option,
                leadTime: r.quote.lead_time_weeks,
                workType: r.quote.work_type,
                big: r.sizes.big,
                small: r.sizes.small,
              }))}
            />
          </section>
        </div>

        <aside className="divide-y divide-border rounded-xl border border-border bg-white lg:sticky lg:top-6">
          <section className="space-y-3 p-5">
            <h2 className={sectionTitle}>New invite</h2>
            <InviteForm />
          </section>
          <section className="space-y-3 p-5">
            <h2 className={sectionTitle}>Settings</h2>
            <SettingsForm
              values={{
                artist_deadline_at: utcToNzLocalInput(settings.artist_deadline_at),
                framer_quote_1800x900: settings.framer_quote_1800x900 === null ? "" : String(settings.framer_quote_1800x900),
                framer_quote_1600x800: settings.framer_quote_1600x800 === null ? "" : String(settings.framer_quote_1600x800),
                staff_see_quotes: !!settings.staff_see_quotes,
              }}
            />
          </section>
          <section className="space-y-2 p-5">
            <h2 className={sectionTitle}>Selection</h2>
            {closedAt ? (
              <p className="text-sm text-stone-600">
                Closed {stamp(closedAt)}. Profiles not kept are deleted on {stamp(deleteOn)}, with a reminder at day 21.
              </p>
            ) : (
              <>
                <p className="text-xs text-stone-500">
                  Closing locks Part two and emails every artist who hasn&rsquo;t chosen to keep their profile: keep it, or delete it? Anything not kept is deleted {RETENTION_DAYS} days later.
                </p>
                <CloseSelection />
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

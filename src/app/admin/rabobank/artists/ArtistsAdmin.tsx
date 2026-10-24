"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { ArrowDownUp, Check, Copy } from "lucide-react";
import type { ArtistInvite } from "@/lib/rabobank/invites";
import type { SizeCost } from "@/lib/rabobank/artist-admin";
import { TAKE_GUIDE } from "@/lib/rabobank/take-rules";
import { closeSelection, saveArtistSettings, saveInvite, setShortlisted, type AdminResult } from "./actions";

const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const nzd = (n: number | null) => (n === null ? "–" : "$" + n.toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

function Note({ state, pending }: { state: AdminResult; pending: boolean }) {
  if (pending) return <span className="text-xs text-stone-500">Saving…</span>;
  if (state?.error) return <span className="text-xs text-destructive">{state.error}</span>;
  if (state?.message) return <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Check className="size-3.5" />{state.message}</span>;
  return null;
}

/** One thought: plain text with a live character guide, saved by a server action. */
export function TakeEditor({ action, initial = "", submitLabel, id }: { action: (fd: FormData) => Promise<void>; initial?: string; submitLabel: string; id?: string }) {
  const [value, setValue] = useState(initial);
  const over = value.length > TAKE_GUIDE;
  return (
    <form action={async (fd) => { await action(fd); if (!id) setValue(""); }} className="space-y-1.5">
      {id && <input type="hidden" name="id" value={id} />}
      <textarea name="text" rows={3} value={value} onChange={(e) => setValue(e.target.value)} maxLength={600} className={input} placeholder="Two or three sentences about the work." />
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs ${over ? "text-amber-700" : "text-stone-400"}`}>{value.length} / about {TAKE_GUIDE}</span>
        <button disabled={!value.trim() || value === initial} className="rounded-lg border border-border bg-white px-3 py-1 text-xs font-medium hover:border-stone-400 disabled:opacity-40">{submitLabel}</button>
      </div>
    </form>
  );
}

/** Replaces the creative direction PDF (kept private; artists open it through their own link). */
export function DirectionUpload({ uploadedAt }: { uploadedAt: string | null }) {
  const [state, setState] = useState<{ busy: boolean; error?: string; done?: boolean }>({ busy: false });
  return (
    <div className="space-y-1.5 text-sm">
      <p className="text-stone-600">{uploadedAt ? `Uploaded ${uploadedAt}.` : "No PDF yet. The button stays hidden on artist pages until one is uploaded."}</p>
      <label className="inline-flex cursor-pointer rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:border-stone-400">
        {state.busy ? "Uploading…" : uploadedAt ? "Replace PDF" : "Upload PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setState({ busy: true });
            const body = new FormData();
            body.set("file", file);
            const res = await fetch("/admin/rabobank/artists/direction", { method: "POST", body });
            const json = await res.json().catch(() => null);
            setState(res.ok ? { busy: false, done: true } : { busy: false, error: json?.error ?? "Upload failed." });
          }}
        />
      </label>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.done && <p className="inline-flex items-center gap-1 text-xs text-stone-500"><Check className="size-3.5" /> Saved. Refresh to see the date.</p>}
    </div>
  );
}

export function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button className="text-xs text-destructive underline-offset-4 hover:underline" onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

export function CopyLinks({ email, instagram }: { email: string; instagram: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (which: string, link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {([["email", "Email link", email], ["instagram", "Instagram link", instagram]] as const).map(([k, label, link]) => (
        <button key={k} type="button" onClick={() => void copy(k, link)} className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white hover:opacity-85">
          {copied === k ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied === k ? "Copied" : `Copy ${label.toLowerCase()}`}
        </button>
      ))}
    </div>
  );
}

export function InviteForm({ invite }: { invite?: ArtistInvite }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(saveInvite, null);
  const [image, setImage] = useState(invite?.featured_image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/admin/rabobank/artists/upload", { method: "POST", body });
    const json = await res.json().catch(() => null);
    setUploading(false);
    if (res.ok && json?.url) setImage(json.url);
    else setUploadError(json?.error ?? "Upload failed.");
  }

  return (
    <form action={action} className="space-y-2.5">
      {invite && <input type="hidden" name="id" value={invite.id} />}
      <div className="grid grid-cols-2 gap-2">
        <input name="first_name" required placeholder="First name" defaultValue={invite?.first_name} className={input} maxLength={60} />
        <input name="full_name" placeholder="Full name" defaultValue={invite?.full_name ?? ""} className={input} maxLength={120} />
      </div>
      <input name="email" type="email" placeholder="Email" defaultValue={invite?.email ?? ""} className={input} maxLength={200} />
      <div className="grid grid-cols-2 gap-2">
        <input name="instagram_handle" placeholder="Instagram handle" defaultValue={invite?.instagram_handle ?? ""} className={input} maxLength={60} />
        <select name="channel" defaultValue={invite?.channel ?? "email"} className={input} aria-label="Channel">
          <option value="email">By email</option>
          <option value="instagram">By Instagram DM</option>
        </select>
      </div>
      <textarea name="why_paragraph" rows={4} placeholder="Why you're inviting them (shown under Kia ora)" defaultValue={invite?.why_paragraph ?? ""} className={input} maxLength={1500} />
      <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
        <p className="text-xs font-medium text-stone-600">Featured work</p>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="max-h-32 rounded-md" />
        )}
        <input type="hidden" name="featured_image_url" value={image} />
        <label className="inline-flex cursor-pointer text-xs underline underline-offset-4">
          {uploading ? "Uploading…" : image ? "Replace image" : "Upload image"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        <input name="featured_title" placeholder="Title" defaultValue={invite?.featured_title ?? ""} className={input} maxLength={200} />
        <input name="featured_caption" placeholder="Short caption" defaultValue={invite?.featured_caption ?? ""} className={input} maxLength={400} />
        <input name="featured_source_url" placeholder="Image source link (credit)" defaultValue={invite?.featured_source_url ?? ""} className={input} maxLength={500} />
      </div>
      <input name="site_url" placeholder="Their website" defaultValue={invite?.site_url ?? ""} className={input} maxLength={500} />
      <div className="flex items-center gap-3">
        <button disabled={pending || uploading} className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-85 disabled:opacity-50">
          {invite ? "Save invite" : "Create invite"}
        </button>
        <Note state={state} pending={pending} />
      </div>
    </form>
  );
}

export function SettingsForm({ values }: { values: { artist_deadline_at: string; framer_quote_1800x900: string; framer_quote_1600x800: string; staff_see_quotes: boolean } }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(saveArtistSettings, null);
  return (
    <form action={action} className="space-y-3 text-sm">
      <label className="block space-y-1">
        <span>Response deadline <span className="text-stone-400">· Part one closes, Auckland time</span></span>
        <input type="datetime-local" name="artist_deadline_at" defaultValue={values.artist_deadline_at} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span>Framer 1800</span>
          <input name="framer_quote_1800x900" inputMode="decimal" placeholder="$" defaultValue={values.framer_quote_1800x900} className={input} />
        </label>
        <label className="block space-y-1">
          <span>Framer 1600</span>
          <input name="framer_quote_1600x800" inputMode="decimal" placeholder="$" defaultValue={values.framer_quote_1600x800} className={input} />
        </label>
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="staff_see_quotes" defaultChecked={values.staff_see_quotes} className="mt-0.5 accent-black" />
        <span>Staff see quotes on the shortlist <span className="text-stone-400">· off by default</span></span>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium hover:border-stone-400">Save settings</button>
        <Note state={state} pending={pending} />
      </div>
    </form>
  );
}

export function CloseSelection() {
  const [state, action, pending] = useActionState<AdminResult, FormData>(async () => closeSelection(), null);
  return (
    <form
      action={action}
      onSubmit={(e) => { if (!confirm("Close selection now and send the keep-or-delete emails? This can't be undone.")) e.preventDefault(); }}
      className="space-y-2"
    >
      <button disabled={pending} className="rounded-lg border border-destructive px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50">
        Close selection and send follow-ups
      </button>
      <div><Note state={state} pending={pending} /></div>
    </form>
  );
}

export function ShortlistToggle({ artistId, shortlisted }: { artistId: string; shortlisted: boolean }) {
  const [on, setOn] = useState(shortlisted);
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-medium">
      <input
        type="checkbox"
        className="size-4 accent-black"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          startTransition(async () => {
            const r = await setShortlisted(artistId, next);
            if (r?.error) setOn(!next);
          });
        }}
      />
      Shortlisted for staff
    </label>
  );
}

function SortHeader({ active, right, onClick, children }: { active: boolean; right?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <th className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={onClick}>
        {children}
        <ArrowDownUp className={`size-3 ${active ? "text-foreground" : "text-stone-300"}`} />
      </button>
    </th>
  );
}

type QuoteRowView = {
  id: string;
  name: string;
  gst: string;
  framing: string | null;
  install: string | null;
  leadTime: number | null;
  workType: string | null;
  big: SizeCost;
  small: SizeCost;
};
type SortKey = "name" | "bigFee" | "bigTotal" | "smallFee" | "smallTotal" | "leadTime";
const WHO: Record<string, string> = { self: "Artist", other: "Patronage", unsure: "Not sure" };

export function QuoteTable({ rows }: { rows: QuoteRowView[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "bigTotal", dir: 1 });
  const value = (r: QuoteRowView, k: SortKey): number | string | null =>
    k === "name" ? r.name : k === "bigFee" ? r.big.fee : k === "bigTotal" ? r.big.total : k === "smallFee" ? r.small.fee : k === "smallTotal" ? r.small.total : r.leadTime;
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const x = value(a, sort.key), y = value(b, sort.key);
        if (x === null) return 1;
        if (y === null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      }),
    [rows, sort]
  );
  if (!rows.length) return <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-stone-500">No quotes submitted yet.</p>;

  const th = (k: SortKey, label: string, right?: boolean) => (
    <SortHeader active={sort.key === k} right={right} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
      {label}
    </SortHeader>
  );
  const cost = (c: SizeCost) =>
    c.fee === null ? null : `${nzd(c.fee)} + ${c.framing === null ? "frame ?" : `${nzd(c.framing)} frame${c.framingSource === "artist" ? " (artist)" : ""}`}${c.install !== null ? ` + ${nzd(c.install)} install` : ""}`;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-stone-50 text-xs text-stone-500">
          <tr>
            {th("name", "Artist")}
            {th("bigFee", "1800 fee", true)}
            {th("bigTotal", "1800 total", true)}
            {th("smallFee", "1600 fee", true)}
            {th("smallTotal", "1600 total", true)}
            <th className="px-3 py-2 text-left font-medium">Frame / install</th>
            {th("leadTime", "Weeks", true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-2.5">
                <span className="font-medium">{r.name}</span>
                <span className="block text-xs text-stone-400">{r.gst}{r.workType ? ` · ${r.workType}` : ""}</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{nzd(r.big.fee)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums" title={cost(r.big) ?? ""}>
                <span className="font-medium">{nzd(r.big.total)}</span>
                {r.big.total !== null && <span className="block text-xs text-stone-400">indicative</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{nzd(r.small.fee)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums" title={cost(r.small) ?? ""}>
                <span className="font-medium">{nzd(r.small.total)}</span>
                {r.small.total !== null && <span className="block text-xs text-stone-400">indicative</span>}
              </td>
              <td className="px-3 py-2.5 text-xs text-stone-600">
                {WHO[r.framing ?? ""] ?? "–"} / {WHO[r.install ?? ""] ?? "–"}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.leadTime ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { ArrowDownUp, Check, Copy } from "lucide-react";
import type { ArtistInvite } from "@/lib/rabobank/invites";
import type { Extra, SizeCost } from "@/lib/rabobank/artist-admin";
import { closeSelection, saveArtistSettings, saveInvite, setShortlisted, type AdminResult } from "./actions";

const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
/** Whole dollars, for comparing quotes at a glance (GST conversions produce cents nobody quoted). */
const dollars = (n: number | null) => (n === null ? "–" : "$" + Math.round(n).toLocaleString("en-NZ"));

function Note({ state, pending }: { state: AdminResult; pending: boolean }) {
  if (pending) return <span className="text-xs text-stone-500">Saving…</span>;
  if (state?.error) return <span className="text-xs text-destructive">{state.error}</span>;
  if (state?.message) return <span className="inline-flex items-center gap-1 text-xs text-stone-500"><Check className="size-3.5" />{state.message}</span>;
  return null;
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

/** One of the two works that caught Blake's eye: an image plus its title, caption and credit. */
function FeaturedSlot({ label, suffix, initial, onBusy }: {
  label: string;
  suffix: "" | "_2";
  initial: { image: string | null | undefined; title: string | null | undefined; caption: string | null | undefined; source: string | null | undefined };
  onBusy: (busy: boolean) => void;
}) {
  const [image, setImage] = useState(initial.image ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    onBusy(true);
    setUploadError(null);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/admin/rabobank/artists/upload", { method: "POST", body });
    const json = await res.json().catch(() => null);
    setUploading(false);
    onBusy(false);
    if (res.ok && json?.url) setImage(json.url);
    else setUploadError(json?.error ?? "Upload failed.");
  }

  // The first slot keeps the original (216) column names.
  const names = suffix
    ? { image: "featured_image_2_url", title: "featured_title_2", caption: "featured_caption_2", source: "featured_source_url_2" }
    : { image: "featured_image_url", title: "featured_title", caption: "featured_caption", source: "featured_source_url" };
  return (
    <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
      <p className="text-xs font-medium text-stone-600">{label}</p>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="max-h-32 rounded-md" />
      )}
      <input type="hidden" name={names.image} value={image} />
      <div className="flex gap-3 text-xs">
        <label className="inline-flex cursor-pointer underline underline-offset-4">
          {uploading ? "Uploading…" : image ? "Replace image" : "Upload image"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {image && <button type="button" className="text-stone-500 underline-offset-4 hover:underline" onClick={() => setImage("")}>Remove</button>}
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      <input name={names.title} placeholder="Title" defaultValue={initial.title ?? ""} className={input} maxLength={200} />
      <input name={names.caption} placeholder="Short caption" defaultValue={initial.caption ?? ""} className={input} maxLength={400} />
      <input name={names.source} placeholder="Image source link (credit)" defaultValue={initial.source ?? ""} className={input} maxLength={500} />
    </div>
  );
}

export function InviteForm({ invite }: { invite?: ArtistInvite }) {
  const [state, action, pending] = useActionState<AdminResult, FormData>(saveInvite, null);
  const [busy, setBusy] = useState(0);
  const onBusy = (b: boolean) => setBusy((n) => n + (b ? 1 : -1));

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
      <div className="space-y-1">
        <textarea
          name="thoughts"
          rows={5}
          placeholder="Thoughts for their question 4 (Your approach). One per line, up to 12. Only this artist sees them, one at a time."
          defaultValue={(invite?.thoughts ?? []).join("\n")}
          className={input}
          maxLength={12 * 610}
        />
      </div>
      <FeaturedSlot label="Work that caught my eye (1)" suffix="" onBusy={onBusy} initial={{ image: invite?.featured_image_url, title: invite?.featured_title, caption: invite?.featured_caption, source: invite?.featured_source_url }} />
      <FeaturedSlot label="Work that caught my eye (2)" suffix="_2" onBusy={onBusy} initial={{ image: invite?.featured_image_2_url, title: invite?.featured_title_2, caption: invite?.featured_caption_2, source: invite?.featured_source_url_2 }} />
      <div className="flex items-center gap-3">
        <button disabled={pending || busy > 0} className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:opacity-85 disabled:opacity-50">
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
  /** How the artist entered their amounts: plus GST, incl. GST, or not GST registered. */
  gst: string | null;
  enteredIncl: boolean;
  entered: { big: number | null; small: number | null };
  basedIn: string | null;
  scale: string | null;
  altSize: string | null;
  ready: { label: string; sort: string };
  big: SizeCost;
  small: SizeCost;
};
type SortKey = "name" | "bigFee" | "smallFee" | "bigTotal" | "smallTotal" | "ready";
const WHO: Record<string, string> = { self: "Artist does it", other: "We arrange it", unsure: "Not sure yet" };

/** Framing or installation: who does it, then the cost or that there isn't one yet. */
function ExtraCell({ e, label }: { e: Extra; label: string }) {
  return (
    <td className="px-3 py-2.5">
      <span className="block">{e.who ? WHO[e.who] : "–"}</span>
      <span className={`block text-xs ${e.cost === null ? "text-amber-700" : "text-stone-500"}`}>
        {e.cost !== null ? `${dollars(e.cost)}${e.costFrom === "framer" ? " (your framer)" : ""}` : `No ${label} cost yet`}
      </span>
    </td>
  );
}

/** Fee plus known costs for one size, and what it still leaves out. A size the artist didn't quote shows a dash. */
function TotalCell({ c }: { c: SizeCost }) {
  return (
    <td className="px-3 py-2.5 text-right tabular-nums">
      <span className="block font-medium">{dollars(c.total)}</span>
      <span className={`block text-xs ${c.missing.length ? "text-amber-700" : "text-stone-400"}`}>
        {c.total === null ? "" : c.missing.length ? `plus ${c.missing.join(" and ")}` : "everything included"}
      </span>
    </td>
  );
}

export function QuoteTable({ rows }: { rows: QuoteRowView[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "bigFee", dir: 1 });
  const value = (r: QuoteRowView, k: SortKey): number | string | null =>
    k === "name" ? r.name : k === "bigFee" ? r.big.fee : k === "smallFee" ? r.small.fee : k === "bigTotal" ? r.big.total : k === "smallTotal" ? r.small.total : r.ready.sort;
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
  const fee = (exGst: number | null, entered: number | null, incl: boolean) => (
    <td className="px-3 py-2.5 text-right tabular-nums">
      <span className="block font-medium">{dollars(exGst)}</span>
      {incl && entered !== null && <span className="block text-xs text-stone-400">entered {dollars(entered)} incl.</span>}
    </td>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="bg-stone-50 text-xs text-stone-500">
          <tr>
            {th("name", "Artist")}
            {th("bigFee", "Artwork 1800 × 900", true)}
            {th("smallFee", "Artwork 1600 × 800", true)}
            <th className="px-3 py-2 text-left font-medium">Framing</th>
            <th className="px-3 py-2 text-left font-medium">Installation</th>
            {th("bigTotal", "Known total, 1800", true)}
            {th("smallTotal", "Known total, 1600", true)}
            {th("ready", "Ready by", true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-2.5">
                <span className="block font-medium">{r.name}</span>
                <span className="block text-xs text-stone-400">{[r.gst && (r.gst === "not GST registered" ? "Not GST registered" : `Entered ${r.gst}`), r.basedIn, r.scale].filter(Boolean).join(" · ")}</span>
                {r.altSize && <span className="mt-1 block max-w-[16rem] text-xs text-stone-500" title={r.altSize}>Size note: {r.altSize.length > 90 ? `${r.altSize.slice(0, 90)}…` : r.altSize}</span>}
              </td>
              {fee(r.big.fee, r.entered.big, r.enteredIncl)}
              {fee(r.small.fee, r.entered.small, r.enteredIncl)}
              <ExtraCell e={r.big.framing} label="framing" />
              <ExtraCell e={r.big.install} label="install" />
              <TotalCell c={r.big} />
              <TotalCell c={r.small} />
              <td className="px-3 py-2.5 text-right">{r.ready.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

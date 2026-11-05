"use client";

import { useState } from "react";
import { Gallery } from "../../_components/Gallery";
import type { Work } from "@/lib/rabobank/shortlist";

/** One size, itemised. All amounts in dollars; null means nobody has priced it. */
export interface Receipt {
  artwork: number;
  framing: number | null;
  install: number | null;
  artistInstalls: boolean;
  excl: number;
  gst: number;
  incl: number;
}

export interface ArtistCost {
  id: string;
  name: string;
  photo: string | null;
  place: string | null;
  bio: string | null;
  works: Work[];
  ready: string;
  registered: boolean;
  sizes: { small: Receipt | null; big: Receipt | null };
}

const SIZES = [
  ["small", "1600 × 800 mm"],
  ["big", "1800 × 900 mm"],
] as const;

const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-NZ");

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "font-medium" : ""} ${muted ? "text-stone-400" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** The receipt: each part on its own line, then the two totals. */
function ReceiptView({ r, registered }: { r: Receipt; registered: boolean }) {
  const gstNote = !registered ? (r.gst ? " (installer only)" : "") : "";
  return (
    <dl className="space-y-1.5 text-sm">
      <Line label="Artwork" value={dollars(r.artwork)} />
      <Line label="Framing" value={r.framing === null ? "To be quoted" : dollars(r.framing)} muted={r.framing === null} />
      <Line label="Installation" value={r.install !== null ? dollars(r.install) : r.artistInstalls ? "Artist installs" : "To be quoted"} muted={r.install === null} />
      <div className="!mt-3 space-y-1.5 border-t border-stone-200 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-medium">Cost to Rabobank<span className="block text-xs font-normal text-stone-500">excluding GST</span></dt>
          <dd className="text-2xl font-medium tabular-nums">{dollars(r.excl)}</dd>
        </div>
        <Line label={`GST${gstNote}`} value={r.gst ? `+ ${dollars(r.gst)}` : "None, not registered"} muted />
        <div className="flex items-baseline justify-between gap-3 text-stone-700">
          <dt>Paid out<span className="block text-xs text-stone-500">including GST</span></dt>
          <dd className="text-lg tabular-nums">{dollars(r.incl)}</dd>
        </div>
      </div>
      {r.framing === null && <p className="pt-1 text-xs text-amber-700">Plus framing, once it&rsquo;s quoted.</p>}
    </dl>
  );
}

/** Side by side, one size at a time, so each card reads as a single receipt. */
export function Costs({ artists, installAllowance }: { artists: ArtistCost[]; installAllowance: number }) {
  const [size, setSize] = useState<"small" | "big">("small");
  return (
    <>
      <div className="mb-8 inline-flex rounded-full border border-stone-300 bg-white p-1 text-sm" role="group" aria-label="Artwork size">
        {SIZES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={size === key}
            onClick={() => setSize(key)}
            className={`rounded-full px-4 py-1.5 ${size === key ? "bg-black text-white" : "text-stone-600 hover:text-black"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {artists.map((a) => {
          const r = a.sizes[size];
          return (
            <article key={a.id} className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5">
              <header className="flex items-center gap-3">
                {a.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" style={{ height: "3rem", width: "3rem" }} />
                )}
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-medium">{a.name}</h3>
                  <p className="truncate text-xs text-stone-500">{[a.place, `Ready ${a.ready}`].filter(Boolean).join(" · ")}</p>
                </div>
              </header>
              {a.bio && <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">{a.bio}</p>}
              <Gallery works={a.works.slice(0, 8)} artistName={a.name} artistPhoto={a.photo} layout="thumbs" />
              <div className="mt-auto border-t border-stone-100 pt-4">
                {r ? <ReceiptView r={r} registered={a.registered} /> : <p className="text-sm text-stone-400">Not quoted at this size.</p>}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-8 max-w-3xl space-y-1.5 text-sm leading-relaxed text-stone-500">
        <p><strong className="font-medium text-stone-700">Cost to Rabobank</strong> is the figure to compare. Rabobank claims the GST back, so this is what the artwork really costs.</p>
        <p><strong className="font-medium text-stone-700">Paid out</strong> is what the invoices add up to, before the GST is claimed back. Artists who aren&rsquo;t GST registered don&rsquo;t charge any.</p>
        <p>Installation is allowed at {dollars(installAllowance)} plus GST (quoted at $300–400), unless the artist installs it themselves.</p>
      </div>
    </>
  );
}

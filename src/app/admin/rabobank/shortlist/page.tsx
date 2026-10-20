import type { Metadata } from "next";
import { getArtistCards, getCommercial } from "@/lib/rabobank/shortlist";
import {
  createArtist, deleteArtist, deleteWork, moveArtist, moveWork, toggleArtist, updateArtist, updateWork,
} from "./actions";
import { WorkUploader } from "./WorkUploader";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rabobank shortlist", robots: { index: false, follow: false } };

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const small = "rounded-md border border-input px-2 py-1 text-xs";

export default async function ShortlistAdmin() {
  const [artists, commercial] = await Promise.all([getArtistCards({ includeHidden: true }), getCommercial()]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">Shortlist</h1>
      <p className="text-sm text-muted-foreground">
        Fee and timeline appear only on the client link. Hidden artists are not shown to staff or the client.
        Upload 5 to 8 works per artist.
      </p>

      <form action={createArtist} className="flex gap-2">
        <input name="name" placeholder="New artist name" className={input} maxLength={120} required />
        <button className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Add artist</button>
      </form>

      {artists.map((a, i) => {
        const c = commercial[a.id];
        return (
          <section key={a.id} className="space-y-4 rounded-xl border border-border p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {a.name} {!a.visible && <span className="text-sm font-normal text-muted-foreground">(hidden)</span>}
              </h2>
              <div className="flex flex-wrap gap-2">
                <form action={moveArtist}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="dir" value="up" /><button className={small} disabled={i === 0}>Move up</button></form>
                <form action={moveArtist}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="dir" value="down" /><button className={small} disabled={i === artists.length - 1}>Move down</button></form>
                <form action={toggleArtist}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="visible" value={String(!a.visible)} /><button className={small}>{a.visible ? "Hide" : "Show"}</button></form>
                <form action={deleteArtist}><input type="hidden" name="id" value={a.id} /><button className={`${small} text-destructive`}>Delete</button></form>
              </div>
            </div>

            <form action={updateArtist} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={a.id} />
              <label className="space-y-1 text-sm"><span className="font-medium">Name</span><input name="name" defaultValue={a.name} className={input} maxLength={120} required /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Region</span><input name="region" defaultValue={a.region ?? ""} className={input} maxLength={120} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Medium</span><input name="medium" defaultValue={a.medium ?? ""} className={input} maxLength={200} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Website or Patronage profile</span><input name="website_url" defaultValue={a.website_url ?? ""} className={input} maxLength={300} /></label>
              <label className="space-y-1 text-sm sm:col-span-2"><span className="font-medium">Curator note (one or two sentences)</span><textarea name="curator_note" defaultValue={a.curator_note ?? ""} rows={2} className={input} maxLength={800} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Indicative fee (client only)</span><input name="fee_indicative" defaultValue={c?.fee_indicative ?? ""} className={input} maxLength={200} /></label>
              <label className="space-y-1 text-sm"><span className="font-medium">Indicative timeline (client only)</span><input name="timeline_indicative" defaultValue={c?.timeline_indicative ?? ""} className={input} maxLength={200} /></label>
              <div className="sm:col-span-2"><button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Save artist</button></div>
            </form>

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Works ({a.works.length})</h3>
              <ul className="space-y-3">
                {a.works.map((w, wi) => (
                  <li key={w.id} className="flex flex-col gap-3 sm:flex-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.thumb_url || w.image_url} alt={w.title || "Work"} className="h-24 w-24 shrink-0 rounded-md object-cover" />
                    <form action={updateWork} className="grid flex-1 gap-2 sm:grid-cols-5">
                      <input type="hidden" name="id" value={w.id} />
                      <input name="title" defaultValue={w.title ?? ""} placeholder="Title" aria-label="Title" className={input} maxLength={200} />
                      <input name="size" defaultValue={w.size ?? ""} placeholder="Size" aria-label="Size" className={input} maxLength={100} />
                      <input name="year" defaultValue={w.year ?? ""} placeholder="Year" aria-label="Year" className={input} maxLength={20} />
                      <input name="medium" defaultValue={w.medium ?? ""} placeholder="Medium" aria-label="Medium" className={input} maxLength={200} />
                      <button className={small}>Save</button>
                    </form>
                    <div className="flex gap-2 sm:flex-col">
                      <form action={moveWork}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="artist_id" value={a.id} /><input type="hidden" name="dir" value="up" /><button className={small} disabled={wi === 0}>Up</button></form>
                      <form action={moveWork}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="artist_id" value={a.id} /><input type="hidden" name="dir" value="down" /><button className={small} disabled={wi === a.works.length - 1}>Down</button></form>
                      <form action={deleteWork}><input type="hidden" name="id" value={w.id} /><button className={`${small} text-destructive`}>Delete</button></form>
                    </div>
                  </li>
                ))}
              </ul>
              <WorkUploader artistId={a.id} />
            </div>
          </section>
        );
      })}
      {!artists.length && <p className="text-muted-foreground">No artists yet. Add the first one above.</p>}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadArtistAdmin, type SizeCost } from "@/lib/rabobank/artist-admin";
import { getArtistCards, type ArtistCard } from "@/lib/rabobank/shortlist";
import { gstOf, readyBy } from "@/lib/rabobank/quote";
import { Gallery } from "../../_components/Gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke artists",
  robots: { index: false, follow: false },
};

/** Installation is priced from Blake's installer, not the artists: an estimate range, excluding GST. */
const INSTALL = { min: 300, max: 400 };

const dollars = (n: number) => "$" + Math.round(n).toLocaleString("en-NZ");
const SCALE: Record<string, string> = { often: "Works at this scale often", some: "Has worked at this scale once or twice", largest: "This would be their largest work" };

/** Artwork plus framing plus installation for one size, excluding GST. Installation is a range, so the total is too. */
function sizeTotal(c: SizeCost, artistInstalls: boolean) {
  if (c.fee === null) return null;
  const install = artistInstalls && c.install.cost !== null ? { min: c.install.cost, max: c.install.cost } : artistInstalls ? null : INSTALL;
  const base = c.fee + (c.framing.cost ?? 0);
  return {
    fee: c.fee,
    framing: c.framing.cost,
    install,
    min: base + (install?.min ?? 0),
    max: base + (install?.max ?? 0),
    framingPending: c.framing.cost === null,
  };
}

type Total = NonNullable<ReturnType<typeof sizeTotal>>;
const range = (t: Total) => (Math.round(t.min) === Math.round(t.max) ? dollars(t.min) : `${dollars(t.min)}–${dollars(t.max)}`);

/**
 * For Blake's meeting with Rabobank: every artist who has responded, one
 * section each, then a side-by-side page with prices. Admin only; reads the
 * artists whether or not they are on the staff shortlist.
 */
export default async function Presentation() {
  if (!(await isAdmin())) notFound();
  const [{ rows }, cards] = await Promise.all([loadArtistAdmin(), getArtistCards({ includeHidden: true })]);

  const people = rows
    .filter((r) => r.quote?.status === "submitted" && r.quote.interested !== "no")
    .map((r) => ({ row: r, card: cards.find((c) => c.invite_id === r.invite.id) ?? null }))
    .filter((p): p is { row: typeof p.row; card: ArtistCard } => !!p.card)
    .sort((a, b) => a.card.sort_order - b.card.sort_order);

  return (
    <div className="min-h-screen bg-[#FAFAF9] text-stone-900">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8">
        {/* Cover */}
        <section className="flex min-h-[80vh] flex-col justify-center gap-8 py-16 lg:flex-row lg:items-center lg:gap-16">
          <div className="max-w-xl space-y-4">
            <p className="text-xs font-medium uppercase tracking-widest text-[#000FAA]">Rabobank Te Puke · Event space artwork</p>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl">The artists</h1>
            <p className="text-lg leading-relaxed text-stone-600">
              {people.length} artists have responded to the brief, each with a quote and a selection of their work. The last page sets them side by side, with costs.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rabobank-pilot/room.webp" alt="The Te Puke event space" className="w-full max-w-3xl rounded-[4px] shadow-xl" />
        </section>

        {/* One section per artist */}
        {people.map(({ row, card }, i) => (
          <section key={card.id} className="border-t border-stone-200 py-16" aria-labelledby={`a-${card.id}`}>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-16">
              <div className="space-y-5">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Artist {i + 1} of {people.length}</p>
                <div className="flex items-center gap-4">
                  {card.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.photo_url} alt="" className="size-20 shrink-0 rounded-full object-cover" />
                  )}
                  <div>
                    <h2 id={`a-${card.id}`} className="text-3xl font-medium">{card.name}</h2>
                    <p className="text-sm text-stone-500">{[card.region || row.quote.based_in, SCALE[row.quote.scale_experience]].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                {row.quote.approach_text && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Their response to the brief</p>
                    <p className="whitespace-pre-line text-lg leading-relaxed">{row.quote.approach_text}</p>
                  </div>
                )}
                {card.bio && <p className="whitespace-pre-line leading-relaxed text-stone-600">{card.bio}</p>}
                {card.staff_prompt_answer && (
                  <blockquote className="border-l-2 border-[#FF6700]/60 pl-4 text-stone-600">
                    <p className="mb-1 text-xs text-stone-400">What they&rsquo;d like someone to feel in front of their work</p>
                    {card.staff_prompt_answer}
                  </blockquote>
                )}
              </div>
              <Gallery works={card.works} artistName={card.name} layout="natural" />
            </div>
          </section>
        ))}

        {/* Side by side, with costs */}
        <section className="border-t border-stone-200 py-16" aria-labelledby="compare">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Side by side</p>
          <h2 id="compare" className="mb-10 mt-2 text-3xl font-medium">The artists and their costs</h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {people.map(({ row, card }) => {
              const artistInstalls = row.quote.install_option === "self";
              const big = sizeTotal(row.sizes.big, artistInstalls);
              const small = sizeTotal(row.sizes.small, artistInstalls);
              const gst = gstOf(row.quote);
              return (
                <article key={card.id} className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-5">
                  <header className="flex items-center gap-3">
                    {card.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.photo_url} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-medium">{card.name}</h3>
                      <p className="truncate text-xs text-stone-500">{card.region || row.quote.based_in || " "}</p>
                    </div>
                  </header>
                  {card.bio && <p className="line-clamp-4 text-sm leading-relaxed text-stone-600">{card.bio}</p>}
                  <ul className="grid grid-cols-4 gap-1.5">
                    {card.works.slice(0, 8).map((w) => (
                      <li key={w.id} className="aspect-square overflow-hidden rounded-[3px] bg-stone-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.thumb_url || w.image_url} alt={w.title || `Work by ${card.name}`} className="block h-full w-full max-w-none object-cover" />
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-auto space-y-1.5 border-t border-stone-100 pt-4 text-sm tabular-nums">
                    {[["1800 × 900", big], ["1600 × 800", small]].map(([label, t]) =>
                      t ? (
                        <div key={label as string} className="space-y-0.5">
                          <div className="flex justify-between gap-3 font-medium">
                            <dt>{label as string}</dt>
                            <dd>{range(t as Total)}{(t as Total).framingPending ? " + framing" : ""}</dd>
                          </div>
                          <p className="text-xs text-stone-500">
                            Artwork {dollars((t as Total).fee)}
                            {(t as Total).framing !== null && ` · framing ${dollars((t as Total).framing!)}`}
                            {(t as Total).install && ` · install ${range({ ...(t as Total), min: (t as Total).install!.min, max: (t as Total).install!.max })}`}
                            {artistInstalls && !(t as Total).install && " · artist installs"}
                          </p>
                        </div>
                      ) : (
                        <div key={label as string} className="flex justify-between gap-3 text-stone-400">
                          <dt>{label as string}</dt>
                          <dd>Not quoted</dd>
                        </div>
                      )
                    )}
                    <div className="flex justify-between gap-3 pt-1.5 text-xs text-stone-500">
                      <dt>Ready</dt>
                      <dd>{readyBy(row.quote).label}</dd>
                    </div>
                    {gst === "none" && <p className="text-xs text-stone-500">Not GST registered, so no GST is added.</p>}
                  </dl>
                </article>
              );
            })}
          </div>
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-stone-500">
            All amounts exclude GST. Installation is estimated at {dollars(INSTALL.min)}–{dollars(INSTALL.max)} unless the artist installs it themselves. Framing is the artist&rsquo;s own figure where they frame the work; &ldquo;+ framing&rdquo; means it will be quoted separately.
          </p>
        </section>
      </div>
    </div>
  );
}

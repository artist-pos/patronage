import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { loadArtistAdmin, type SizeCost } from "@/lib/rabobank/artist-admin";
import { getArtistCards, type ArtistCard } from "@/lib/rabobank/shortlist";
import { gstOf, readyBy } from "@/lib/rabobank/quote";
import { Gallery } from "../../_components/Gallery";
import { WallViewer } from "@/components/rabobank/WallViewer";
import { Costs, type Receipt } from "./Costs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke artists",
  robots: { index: false, follow: false },
};

/** Installation comes from Blake's installer (quoted $300–400): allowed at the top of that, excluding GST. */
const INSTALL_ALLOWANCE = 400;
/** Framing by Blake's framer where the artist isn't framing it themselves, excluding GST. */
const FRAMING_ALLOWANCE = 800;
const GST_RATE = 0.15;
/** Rabobank's budget, excluding GST (possibly some movement for the right artist); and Blake's offer from his $2,500 fee. */
const BUDGET = 5000;
const CONTRIBUTION = 1250;

const SCALE: Record<string, string> = { often: "Works at this scale often", some: "Has worked at this scale once or twice", largest: "This would be their largest work" };

/**
 * One size, itemised. The artist's parts carry GST only if they're registered;
 * the installer is assumed to charge it.
 */
function receipt(c: SizeCost, artistInstalls: boolean, registered: boolean): Receipt | null {
  if (c.fee === null) return null;
  // The artist's own framing figure, or Blake's framer at the allowance (who charges GST).
  const artistFrames = c.framing.costFrom === "artist" && c.framing.cost !== null;
  const framing = artistFrames ? c.framing.cost : FRAMING_ALLOWANCE;
  const install = artistInstalls ? c.install.cost : INSTALL_ALLOWANCE;
  const artistPart = c.fee + (artistFrames ? framing ?? 0 : 0) + (artistInstalls ? install ?? 0 : 0);
  const othersPart = (artistFrames ? 0 : framing ?? 0) + (artistInstalls ? 0 : install ?? 0);
  const excl = artistPart + othersPart;
  const gst = (registered ? artistPart * GST_RATE : 0) + othersPart * GST_RATE;
  return { artwork: c.fee, framing, framingAllowance: !artistFrames, install, artistInstalls, excl, gst, incl: excl + gst };
}

/**
 * For Blake's meeting with Rabobank: every artist who has responded, one
 * section each, then a side-by-side page with costs. Admin only; reads the
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
          <div className="max-w-xl space-y-4 lg:w-[30rem] lg:shrink-0">
            <p className="text-xs font-medium uppercase tracking-widest text-[#000FAA]">Rabobank Te Puke · Event space artwork</p>
            <h1 className="text-4xl font-medium leading-tight sm:text-5xl">The artists</h1>
            <p className="text-lg leading-relaxed text-stone-600">
              {people.length} artists have responded to the brief, each with a quote and a selection of their work. The last page sets them side by side, with costs.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/rabobank-pilot/room.webp" alt="The Te Puke event space" className="w-full min-w-0 max-w-3xl rounded-[4px] shadow-xl lg:flex-1" />
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
              <Gallery works={card.works} artistName={card.name} artistPhoto={card.photo_url} layout="natural" />
            </div>
          </section>
        ))}

        {/* Side by side, with costs */}
        <section className="border-t border-stone-200 py-16" aria-labelledby="compare">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Side by side</p>
          <h2 id="compare" className="mb-6 mt-2 text-3xl font-medium">The artists and their costs</h2>
          <Costs
            installAllowance={INSTALL_ALLOWANCE}
            framingAllowance={FRAMING_ALLOWANCE}
            contribution={CONTRIBUTION}
            budget={BUDGET}
            artists={people.map(({ row, card }) => {
              const artistInstalls = row.quote.install_option === "self";
              const registered = gstOf(row.quote) !== "none";
              return {
                id: card.id,
                name: card.name,
                photo: card.photo_url,
                place: card.region || row.quote.based_in || null,
                bio: card.bio,
                works: card.works,
                ready: readyBy(row.quote).label,
                registered,
                sizes: {
                  small: receipt(row.sizes.small, artistInstalls, registered),
                  big: receipt(row.sizes.big, artistInstalls, registered),
                },
              };
            })}
          />
        </section>

        {/* The two sizes against the wall, to scale. */}
        <section className="border-t border-stone-200 py-16" aria-labelledby="wall">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">To scale</p>
          <h2 id="wall" className="mb-6 mt-2 text-3xl font-medium">The two sizes on the wall</h2>
          <div className="max-w-5xl">
            <WallViewer
              initialSize="small"
              table={false}
              heading=""
              intro="The wall is dark blue, 3600mm long and 2400mm high. Switch between the two sizes, turn the table on to see it in the room, or choose a work to hang it on the wall."
              choices={people.map(({ card }) => ({
                artist: card.name,
                works: card.works.map((w) => ({ id: w.id, title: w.title, url: w.image_url })),
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

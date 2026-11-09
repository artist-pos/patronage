import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyToken } from "@/lib/rabobank/tokens";
import { getSettings } from "@/lib/rabobank/settings";
import { formatNz, windowState } from "@/lib/rabobank/time";
import { DEFAULT_SHORTLIST_INTRO, getArtistCards, getArtistResponses } from "@/lib/rabobank/shortlist";
import { StaffShortlist } from "./StaffShortlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Te Puke event space shortlist",
  robots: { index: false, follow: false },
};

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#000FAA]">Rabobank Te Puke · Event space artwork</p>
      <h1 className="mb-3 text-2xl font-semibold">Te Puke event space shortlist</h1>
      <p className="text-stone-600" role="status">{children}</p>
    </div>
  );
}

export default async function StaffShortlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await verifyToken(token, "staff"))) notFound();

  const settings = await getSettings();
  const state = windowState(settings.shortlist_open_at, settings.shortlist_close_at);
  if (state === "before") return <Notice>The shortlist opens {formatNz(settings.shortlist_open_at)}. Please check back then.</Notice>;
  if (state === "closed") return <Notice>Responses have closed. Thank you to everyone who took part.</Notice>;

  // Shortlisted artists, works, Blake's notes and their own responses. Fees and timelines are never loaded here.
  const artists = await getArtistCards({ includeHidden: false });
  if (!artists.length) return <Notice>The shortlist isn&rsquo;t ready yet. Please check back soon.</Notice>;
  const responses = await getArtistResponses(artists);

  return (
    <StaffShortlist
      artists={artists}
      responses={responses}
      token={token}
      nameMode={settings.collect_first_name}
      intro={settings.shortlist_intro?.trim() || DEFAULT_SHORTLIST_INTRO}
      closes={settings.shortlist_close_at ? formatNz(settings.shortlist_close_at) : null}
    />
  );
}

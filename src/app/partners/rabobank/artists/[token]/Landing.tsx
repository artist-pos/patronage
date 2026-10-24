import { formatNzDate } from "@/lib/rabobank/time";
import type { ArtistInvite, PartStatus } from "@/lib/rabobank/invites";
import type { ProfileState, QuoteState } from "@/lib/rabobank/artist-data";
import { safeUrl } from "@/lib/rabobank/shortlist";
import { COPY } from "@/lib/rabobank/artist-copy";
import { WallViewer } from "@/components/rabobank/WallViewer";
import { ArtistParts } from "./ArtistParts";

/** The invited artist's page, given its data. Kept free of loading so a preview can render it. */
export function Landing({
  token,
  invite,
  deadlineAt,
  open,
  quote,
  profile,
}: {
  token: string;
  invite: ArtistInvite;
  deadlineAt: string | null;
  open: { partOneOpen: boolean; partTwoOpen: boolean };
  quote: QuoteState;
  profile: ProfileState;
}) {
  const partOne: PartStatus =
    quote.status === "submitted" && !quote.unsubmitted ? "done" : quote.status === "none" ? "not_started" : "saved";
  const partTwo: PartStatus =
    profile.state && ["complete", "private_only", "kept"].includes(profile.state) ? "done" : profile.exists ? "saved" : "not_started";
  const featured = safeUrl(invite.featured_image_url);
  const source = safeUrl(invite.featured_source_url);
  const site = safeUrl(invite.site_url);
  const brief = COPY.landing.briefBody.split(/\n{2,}/);

  return (
    <>
      <header className="space-y-5">
        <h1 className="text-4xl font-light tracking-tight sm:text-5xl">{COPY.landing.greeting(invite.first_name)}</h1>
        {invite.why_paragraph && (
          <div className="space-y-3 text-lg leading-relaxed">
            {invite.why_paragraph.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
      </header>

      {featured && (
        <figure className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={featured} alt={invite.featured_title ?? ""} className="w-full rounded-xl" />
          <figcaption className="text-sm text-stone-500">
            {invite.featured_title && <span className="font-medium text-stone-700">{invite.featured_title}</span>}
            {invite.featured_caption && <span>{invite.featured_title ? ". " : ""}{invite.featured_caption}</span>}
            <span className="block">
              {COPY.landing.featuredCredit}
              {source && <> <a href={source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{source.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></>}
            </span>
          </figcaption>
        </figure>
      )}
      {site && (
        <p className="-mt-8 text-sm">
          <a href={site} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{COPY.landing.siteLink}</a>
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">{COPY.landing.briefHeading}</h2>
        <div className="space-y-3 leading-relaxed">{brief.map((p, i) => <p key={i}>{p}</p>)}</div>
        {deadlineAt && <p className="text-sm text-stone-600">{COPY.landing.deadline(formatNzDate(deadlineAt))}</p>}
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">{COPY.landing.wallHeading}</h2>
        <WallViewer />
      </section>

      <ArtistParts
        token={token}
        declined={!!invite.declined_at}
        declineSuggestion={invite.decline_suggestion ?? ""}
        hasEmail={!!invite.email}
        open={open}
        status={{ partOne, partTwo }}
        quote={quote}
        profile={profile}
      />
    </>
  );
}

import type { ArtistInvite } from "@/lib/rabobank/invites";
import type { ProfileState, QuoteState } from "@/lib/rabobank/artist-data";
import { ArtistFlow } from "./ArtistFlow";

/** The invited artist's page, given its data. Kept free of loading so a preview can render it. */
export function Landing(props: {
  token: string;
  invite: ArtistInvite;
  deadlineAt: string | null;
  open: { partOneOpen: boolean; partTwoOpen: boolean };
  quote: QuoteState;
  profile: ProfileState;
  takes: string[];
  hasDirection: boolean;
  preview?: boolean;
}) {
  return <ArtistFlow {...props} />;
}

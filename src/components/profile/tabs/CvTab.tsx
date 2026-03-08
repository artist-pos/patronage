import { TrackedLink } from "@/components/profile/TrackedLink";
import type { ExhibitionEntry } from "@/types/database";

interface Props {
  exhibitions: ExhibitionEntry[];
  receivedGrants: string[];
  cvUrl: string | null;
  profileId: string;
  username: string;
  displayName: string;
}

export function CvTab({ exhibitions, receivedGrants, cvUrl, profileId, username }: Props) {
  const soloShows = exhibitions
    .filter((e) => e.type === "Solo")
    .sort((a, b) => b.year - a.year);
  const groupShows = exhibitions
    .filter((e) => e.type === "Group")
    .sort((a, b) => b.year - a.year);

  const hasContent = exhibitions.length > 0 || receivedGrants.length > 0 || cvUrl;

  if (!hasContent) {
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">No CV information yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-8">
      {cvUrl && (
        <div>
          <TrackedLink
            href={cvUrl}
            profileId={profileId}
            username={username}
            eventType="cv_click"
            className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            Download CV →
          </TrackedLink>
        </div>
      )}

      {soloShows.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Solo Exhibitions
          </h3>
          <div className="space-y-1.5">
            {soloShows.map((ex, i) => (
              <p key={i} className="text-sm">
                <span className="font-mono text-muted-foreground">{ex.year}</span>
                {" — "}
                <span className="font-semibold">{ex.title}</span>
                {ex.venue && `, ${ex.venue}`}
                {ex.location && `, ${ex.location}`}
              </p>
            ))}
          </div>
        </section>
      )}

      {groupShows.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Group Exhibitions
          </h3>
          <div className="space-y-1.5">
            {groupShows.map((ex, i) => (
              <p key={i} className="text-sm">
                <span className="font-mono text-muted-foreground">{ex.year}</span>
                {" — "}
                <span className="font-semibold">{ex.title}</span>
                {ex.venue && `, ${ex.venue}`}
                {ex.location && `, ${ex.location}`}
              </p>
            ))}
          </div>
        </section>
      )}

      {receivedGrants.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Grants Received
          </h3>
          <div className="space-y-1.5">
            {receivedGrants.map((grant, i) => (
              <p key={i} className="text-sm">{grant}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import Link from "next/link";
import { TrackedLink } from "@/components/profile/TrackedLink";
import type { ExhibitionEntry, BibliographyEntry, ProfileAchievement } from "@/types/database";

interface Props {
  exhibitions: ExhibitionEntry[];
  bibliography: BibliographyEntry[];
  receivedGrants: string[];
  achievements: ProfileAchievement[];
  cvUrl: string | null;
  profileId: string;
  username: string;
  displayName: string;
  isOwner?: boolean;
}

export function CvTab({ exhibitions, bibliography, receivedGrants, achievements, cvUrl, profileId, username, isOwner }: Props) {
  const sortedExhibitions = [...exhibitions].sort((a, b) => b.year - a.year);

  const hasContent =
    exhibitions.length > 0 ||
    bibliography.length > 0 ||
    receivedGrants.length > 0 ||
    achievements.length > 0 ||
    !!cvUrl;

  if (!hasContent) {
    return (
      <div className="py-8 space-y-2">
        <p className="text-sm text-muted-foreground">No exhibitions or press added yet.</p>
        {isOwner && (
          <p className="text-sm text-muted-foreground">
            <Link
              href="/profile"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Add these in your profile settings →
            </Link>
          </p>
        )}
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
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Download CV →
          </TrackedLink>
        </div>
      )}

      {sortedExhibitions.length > 0 && (
        <section className="space-y-3">
          <h3 className="t-section-label">
            Exhibition History
          </h3>
          <div className="border-t border-border">
            {sortedExhibitions.map((ex, i) => (
              <div key={i} className="flex gap-4 border-b border-border py-2.5 text-sm">
                <span className="font-mono text-muted-foreground w-10 shrink-0">{ex.year}</span>
                <div>
                  <span className="font-semibold">{ex.title}</span>
                  {ex.venue && <span className="text-muted-foreground">, {ex.venue}</span>}
                  {ex.location && <span className="text-muted-foreground">, {ex.location}</span>}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">{ex.type}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {bibliography.length > 0 && (
        <section className="space-y-3">
          <h3 className="t-section-label">
            Bibliography
          </h3>
          <div className="space-y-3">
            {bibliography.map((item, i) => (
              <div key={i} className="text-sm leading-snug">
                {item.title && (
                  <span className="font-semibold">
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:opacity-70 transition-opacity"
                      >
                        &ldquo;{item.title}&rdquo;
                      </a>
                    ) : (
                      <>&ldquo;{item.title}&rdquo;</>
                    )}
                  </span>
                )}
                {item.author && <span className="text-muted-foreground"> — {item.author}</span>}
                {item.publication && <span className="italic text-muted-foreground">, {item.publication}</span>}
                {item.date && <span className="text-muted-foreground">, {item.date}</span>}
                {item.type && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">{item.type}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(achievements.length > 0 || receivedGrants.length > 0) && (
        <section className="space-y-3">
          <h3 className="t-section-label">
            Grants &amp; Awards
          </h3>
          <div className="border-t border-border">
            {achievements.map((a) => (
              <div key={a.id} className="flex items-baseline gap-3 border-b border-border py-2.5 text-sm">
                <span className="font-mono text-muted-foreground w-10 shrink-0">{a.year}</span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold">{a.opportunity_title}</span>
                  <span className="text-muted-foreground">{a.organisation}</span>
                  {a.verified && (
                    <span className="badge badge-grant">
                      Verified
                    </span>
                  )}
                </div>
              </div>
            ))}
            {receivedGrants.map((grant, i) => (
              <p key={i} className="text-sm">{grant}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

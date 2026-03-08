import { TrackedLink } from "@/components/profile/TrackedLink";
import type { BibliographyEntry } from "@/types/database";

interface Props {
  bibliography: BibliographyEntry[];
  profileId: string;
  username: string;
}

export function PressTab({ bibliography, profileId, username }: Props) {
  if (bibliography.length === 0) {
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">No press bibliography yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-8">
      {bibliography.map((item, i) => (
        <p key={i} className="text-sm leading-relaxed">
          {item.author && <span>{item.author}. </span>}
          {item.title && <span>&ldquo;{item.title}.&rdquo; </span>}
          {item.publication && <span className="italic">{item.publication}</span>}
          {item.date && <span>, {item.date}</span>}
          {item.link && (
            <>
              {". "}
              <TrackedLink
                href={item.link}
                profileId={profileId}
                username={username}
                eventType="bib_click"
                className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
              >
                Read →
              </TrackedLink>
            </>
          )}
        </p>
      ))}
    </div>
  );
}

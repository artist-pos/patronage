import type { ProfileWithImage } from "@/types/database";

// Bare signups: mono handles, never fake directory entries.
export function HandleChips({ artists }: { artists: Pick<ProfileWithImage, "id" | "username">[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {artists.map((artist) => (
        <a
          key={artist.id}
          href={`/${artist.username}`}
          className="border border-border bg-card px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          @{artist.username}
        </a>
      ))}
    </div>
  );
}

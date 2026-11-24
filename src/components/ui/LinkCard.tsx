import { parseStoredPreview } from "@/lib/link-preview";

/**
 * The card under a studio update's text when it contains a link, like X's.
 * Takes the stored `link_preview` column as-is and validates it, since the
 * artist can write that column directly.
 */
export function LinkCard({ preview }: { preview: unknown }) {
  const p = parseStoredPreview(preview);
  if (!p) return null;
  const internal = p.url.startsWith("/");

  return (
    <a
      href={p.url}
      {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer nofollow ugc" })}
      className="group mt-4 block overflow-hidden border border-border bg-card transition-colors hover:border-foreground/40"
    >
      {p.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image} alt="" loading="lazy" className="max-h-64 w-full bg-muted object-cover" />
      )}
      <div className="px-4 py-3">
        {p.site && <p className="text-xs text-[color:var(--fg-muted)]">{p.site}</p>}
        <p className="text-sm font-medium leading-snug">{p.title}</p>
        {p.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[color:var(--fg-muted)]">{p.description}</p>
        )}
      </div>
    </a>
  );
}

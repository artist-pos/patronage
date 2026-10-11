import Link from "next/link";

interface Props {
  title: string;
  description: string | null;
  subject: string | null;
  year: number | null;
  coverUrl: string | null;
  panels: string[];
  details: string[];
  artistName: string;
  artistUsername: string;
  seriesId: string;
  isOwner: boolean;
}

const SUBJECT_LABEL: Record<string, string> = {
  art: "Art",
  design: "Design",
  photography: "Photography",
  other: "Folio",
};

/**
 * A school folio: the whole folio first, then each panel, then detail shots.
 * Plain images in reading order. There is no price, edition or enquiry here;
 * folios are never for sale.
 */
export function FolioView({
  title,
  description,
  subject,
  year,
  coverUrl,
  panels,
  details,
  artistName,
  artistUsername,
  seriesId,
  isOwner,
}: Props) {
  const meta = [subject ? SUBJECT_LABEL[subject] ?? null : null, year ? String(year) : null].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
        <Link href={`/${artistUsername}?tab=work`} className="transition-colors hover:text-foreground">
          ← {artistName}
        </Link>
        {isOwner && (
          <>
            <span className="text-border">·</span>
            <Link href={`/studio/series/${seriesId}`} className="transition-colors hover:text-foreground">
              Manage folio
            </Link>
          </>
        )}
      </div>

      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        {description && <p className="max-w-2xl pt-2 text-sm leading-relaxed">{description}</p>}
      </header>

      <div className="space-y-6">
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={`${title}, the whole folio`} className="w-full bg-muted" />
        )}

        {panels.length > 0 && (
          <div className="space-y-6">
            {panels.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt={`${title}, panel ${i + 1}`} className="w-full bg-muted" />
            ))}
          </div>
        )}

        {details.length > 0 && (
          <div className="space-y-3 pt-4">
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Details</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {details.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt={`${title}, detail ${i + 1}`} className="w-full bg-muted" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

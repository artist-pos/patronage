"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteFolio } from "@/app/studio/series/folio-actions";

interface Props {
  seriesId: string;
  title: string;
  slug: string;
  username: string;
  coverUrl: string | null;
  panelCount: number;
}

export function FolioManage({ seriesId, title, slug, username, coverUrl, panelCount }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteFolio(seriesId);
      if (res.error) setError(res.error);
      else router.push("/studio/works?tab=series");
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div className="space-y-2">
        <Link href="/studio/works?tab=series" className="text-sm text-muted-foreground hover:text-foreground">
          ← Series
        </Link>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          A school folio with {panelCount} panel{panelCount === 1 ? "" : "s"}.
        </p>
      </div>

      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt="" className="max-h-72 border border-border" />
      )}

      <Link href={`/${username}/series/${slug}`} className="inline-block text-sm underline underline-offset-2">
        View folio
      </Link>

      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-sm text-muted-foreground">
          Deleting removes the folio and every image in it, including the stored files. This cannot be undone.
        </p>
        {confirming ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="h-10 bg-destructive px-5 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Yes, delete this folio"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-muted-foreground underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-10 border border-destructive px-5 text-sm font-medium text-destructive"
          >
            Delete folio
          </button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

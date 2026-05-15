"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArtworkEditor } from "@/components/dashboard/ArtworkEditor";
import { toggleFeaturedWork, toggleHidePortfolioWork } from "@/app/profile/available-work-actions";
import { deletePortfolioWork } from "@/app/profile/available-work-actions";
import { EditionsSection } from "@/components/studio/EditionsSection";
import { publishWorkToForSale } from "@/app/studio/works/edition-actions";
import type { EditableWork } from "@/components/dashboard/ArtworkEditor";
import type { Edition } from "@/types/database";

interface Props {
  profileId: string;
  work: EditableWork & {
    is_featured: boolean;
    hide_from_archive: boolean;
    linked_artwork_id: string | null;
  };
  editions: Edition[];
}

export function WorkPageClient({ profileId, work: initialWork, editions }: Props) {
  const router = useRouter();
  const [work, setWork] = useState(initialWork);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  async function handleToggleFeatured() {
    setBusy(true);
    const result = await toggleFeaturedWork(work.id, !work.is_featured, 8);
    if (result.error) showError(result.error);
    else setWork(prev => ({ ...prev, is_featured: !prev.is_featured }));
    setBusy(false);
  }

  async function handleToggleHide() {
    setBusy(true);
    const result = await toggleHidePortfolioWork(work.id, !work.hide_from_archive);
    if (result.error) showError(result.error);
    else setWork(prev => ({ ...prev, hide_from_archive: !prev.hide_from_archive }));
    setBusy(false);
  }

  async function handlePublish() {
    setBusy(true);
    const result = await publishWorkToForSale(work.id);
    if (result.error) showError(result.error);
    else router.refresh();
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Permanently delete this work? This cannot be undone.")) return;
    setBusy(true);
    const result = await deletePortfolioWork(work.id);
    if (result.error) { showError(result.error); setBusy(false); return; }
    router.push("/studio?section=works&wt=archival");
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="text-xs text-destructive border border-destructive/30 px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Images + metadata ─────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
          Images & Details
        </h2>
        <ArtworkEditor
          work={work}
          profileId={profileId}
          onCancel={() => router.back()}
          onSaved={(updated) => setWork(prev => ({ ...prev, ...updated }))}
          onThumbnailChange={(url) => setWork(prev => ({ ...prev, url }))}
        />
      </section>

      {/* ── Display settings ──────────────────────────────────── */}
      <section className="border-t border-border pt-6">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
          Display
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleToggleFeatured}
            disabled={busy}
            className={`text-sm border px-4 py-2 transition-colors disabled:opacity-40 ${
              work.is_featured
                ? "border-black bg-black text-white"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {work.is_featured ? "★ Featured" : "Mark as featured"}
          </button>
          <button
            onClick={handleToggleHide}
            disabled={busy}
            className={`text-sm border px-4 py-2 transition-colors disabled:opacity-40 ${
              work.hide_from_archive
                ? "border-black bg-black text-white"
                : "border-border hover:bg-muted/40"
            }`}
          >
            {work.hide_from_archive ? "Hidden from archive" : "Visible in archive"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Featured works appear in your profile overview (up to 8). Hidden works are only visible to you.
        </p>
      </section>

      {/* ── Editions ──────────────────────────────────────────── */}
      <section className="border-t border-border pt-6">
        <EditionsSection workId={work.id} initialEditions={editions} />
        {!work.linked_artwork_id && (
          <div className="mt-6 pt-6 border-t border-border space-y-2">
            <button
              onClick={handlePublish}
              disabled={busy}
              className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Publish to For Sale
            </button>
            <p className="text-xs text-muted-foreground">
              This work isn&apos;t linked to a For Sale listing yet. Click to create one from the first edition.
            </p>
          </div>
        )}
      </section>

      {/* ── Actions ───────────────────────────────────────────── */}
      <section className="border-t border-border pt-6">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
          Actions
        </h2>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-sm text-destructive border border-destructive/30 px-4 py-2 hover:bg-destructive/10 transition-colors disabled:opacity-40"
        >
          Delete work
        </button>
      </section>
    </div>
  );
}

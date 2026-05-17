"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArtworkEditor } from "@/components/dashboard/ArtworkEditor";
import { toggleFeaturedWork, toggleHidePortfolioWork } from "@/app/profile/available-work-actions";
import { deletePortfolioWork } from "@/app/profile/available-work-actions";
import { EditionsSection } from "@/components/studio/EditionsSection";
import { ArtworkProvenancePanel } from "@/app/studio/artworks/[id]/ArtworkProvenancePanel";
import { DocumentationPhotosEditor } from "@/app/studio/artworks/[id]/DocumentationPhotosEditor";
import { PriorHistoryEditor } from "@/app/studio/artworks/[id]/PriorHistoryEditor";
import { ProcessThread } from "@/components/studio/ProcessThread";
import Link from "next/link";
import { publishWorkToForSale } from "@/app/studio/works/edition-actions";
import type { EditableWork } from "@/components/dashboard/ArtworkEditor";
import type { Edition } from "@/types/database";
import type { PriorHistoryEntry } from "@/lib/artwork-prior-history";
import type { DocPhotoType } from "@/lib/artwork-documentation";

interface Props {
  profileId: string;
  work: EditableWork & {
    is_featured: boolean;
    hide_from_archive: boolean;
    is_available: boolean;
    acquisition_mode: "buy_now" | "make_offer" | "enquire_first";
    certificate_note: string | null;
    current_owner_id: string;
    creator_id: string;
    ledger_id: string | null;
  };
  editions: Edition[];
  pendingClaims: { id: string; claimer_name: string; claimer_email: string; claimed_at: string }[];
  ledgerEntries: { id: string; entry_type: string; transfer_method: string; transferred_at: string; owner_name: string }[];
  docPhotos: { id: string; type: DocPhotoType; caption: string | null; signedUrl: string | null }[];
  priorHistory: PriorHistoryEntry[];
  linkedProject: { id: string; title: string } | null;
  linkedProjectUpdates: { id: string; content_type: string; image_url: string | null; caption: string | null; text_content: string | null; created_at: string }[];
  unlinkableProjects: { id: string; title: string; update_count: number }[];
}

function SectionDivider({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border pt-6">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between mb-4"
      >
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && children}
    </section>
  );
}

export function WorkPageClient({
  profileId,
  work: initialWork,
  editions,
  pendingClaims,
  ledgerEntries,
  docPhotos,
  priorHistory,
  linkedProject,
  linkedProjectUpdates,
  unlinkableProjects,
}: Props) {
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

      {/* ── Images & Details ─────────────────────────────────────────── */}
      <ArtworkEditor
        work={work}
        profileId={profileId}
        onCancel={() => router.back()}
        onSaved={(updated) => setWork(prev => ({ ...prev, ...updated }))}
        onThumbnailChange={(url) => setWork(prev => ({ ...prev, url }))}
        linkedProject={linkedProject}
        unlinkableProjects={unlinkableProjects}
        onProjectChanged={() => router.refresh()}
      />

      {/* ── Display — always open, no toggle ─────────────────────────── */}
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
          Featured works appear in your profile overview (up to 8).
          {work.is_available
            ? " Hidden from archive works appear only in Available — not your portfolio."
            : " Hidden works are only visible to you."}
        </p>
      </section>

      {/* ── Editions ─────────────────────────────────────────────────── */}
      <section className="border-t border-border pt-6">
        <EditionsSection workId={work.id} initialEditions={editions} />
        {!work.is_available && (
          <div className="mt-6 pt-6 border-t border-border space-y-2">
            <button
              onClick={handlePublish}
              disabled={busy}
              className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              Publish to Sell
            </button>
            <p className="text-xs text-muted-foreground">
              Creates or restores this work&apos;s listing in the Sell tab.
            </p>
          </div>
        )}
      </section>

      {/* ── Provenance ───────────────────────────────────────────────── */}
      <SectionDivider title="Provenance">
        <ArtworkProvenancePanel
          artwork={{
            id: work.id,
            title: work.title ?? work.caption ?? "Untitled",
            url: work.url ?? null,
            certificate_note: work.certificate_note,
            ledger_id: work.ledger_id,
            is_available: work.is_available,
            current_owner_id: work.current_owner_id,
            creator_id: work.creator_id,
          }}
          pendingClaims={pendingClaims}
          ledgerEntries={ledgerEntries}
        />
      </SectionDivider>

      {/* ── Documentation Photos ─────────────────────────────────────── */}
      <SectionDivider title="Documentation Photos" defaultOpen={false}>
        <DocumentationPhotosEditor
          artworkId={work.id}
          initialPhotos={docPhotos}
        />
      </SectionDivider>

      {/* ── Prior History ────────────────────────────────────────────── */}
      <SectionDivider title="Prior History" defaultOpen={false}>
        <PriorHistoryEditor
          artworkId={work.id}
          initialEntries={priorHistory}
        />
      </SectionDivider>

      {/* ── Transfer ─────────────────────────────────────────────────── */}
      {work.is_available && (
        <section className="border-t border-border pt-6">
          <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
            Transfer
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Once this work has been sold, record the transfer to update provenance.
          </p>
          <Link
            href="/studio/provenance"
            className="text-sm border border-border px-4 py-2 hover:bg-muted/40 transition-colors inline-block"
          >
            Manage provenance →
          </Link>
        </section>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <SectionDivider title="Actions" defaultOpen={false}>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-sm text-destructive border border-destructive/30 px-4 py-2 hover:bg-destructive/10 transition-colors disabled:opacity-40"
        >
          Delete work
        </button>
      </SectionDivider>
    </div>
  );
}

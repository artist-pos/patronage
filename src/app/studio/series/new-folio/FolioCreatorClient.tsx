"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { createFolio, type FolioInput } from "@/app/studio/series/folio-actions";

const MAX_PX = 1800;
const QUALITY = 0.88;
const MAX_IMAGES = 12;

/** Re-encodes through a canvas, which drops EXIF (GPS, device, timestamps) as a
 *  side effect. Every folio image goes through this before it is uploaded. */
async function compressToWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, MAX_PX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(src);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
        "image/webp",
        QUALITY
      );
    };
    img.onerror = () => reject(new Error("That file could not be read as an image"));
    img.src = src;
  });
}

async function upload(profileId: string, file: File, prefix: string): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const blob = await compressToWebp(file);
  const path = `${profileId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const { error } = await supabase.storage.from("portfolio").upload(path, blob, { contentType: "image/webp", upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
}

type Slot = { url: string; previewing?: false } | { uploading: true };

function Thumb({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove image"
        className="absolute right-1 top-1 bg-black/70 p-1 text-white hover:bg-black"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function FolioCreatorClient({ profileId }: { profileId: string }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<FolioInput["subject"]>("art");
  const [year, setYear] = useState(String(thisYear));
  const [cover, setCover] = useState<string | null>(null);
  const [panels, setPanels] = useState<Slot[]>([]);
  const [details, setDetails] = useState<Slot[]>([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const [identifiersCleared, setIdentifiersCleared] = useState(false);
  const [peopleConsent, setPeopleConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function addFiles(files: FileList | null, kind: "panel" | "detail") {
    if (!files) return;
    const setter = kind === "panel" ? setPanels : setDetails;
    const prefix = kind === "panel" ? "folio-panel" : "folio-detail";
    setError(null);
    for (const file of Array.from(files)) {
      if (panels.length + details.length >= MAX_IMAGES) {
        setError(`A folio can have up to ${MAX_IMAGES} images.`);
        break;
      }
      try {
        const url = await upload(profileId, file, prefix);
        setter((prev) => [...prev, { url }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    }
  }

  async function addCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setCoverBusy(true);
    try {
      setCover(await upload(profileId, file, "folio-cover"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setCoverBusy(false);
    }
  }

  const urlsOf = (slots: Slot[]) => slots.flatMap((s) => ("url" in s ? [s.url] : []));
  const ready = !!cover && urlsOf(panels).length > 0 && identifiersCleared && peopleConsent && title.trim().length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cover) return;
    setSaving(true);
    setError(null);
    const res = await createFolio({
      title,
      subject,
      year: year ? Number(year) : null,
      coverUrl: cover,
      panelUrls: urlsOf(panels),
      detailUrls: urlsOf(details),
      identifiersCleared,
      peopleConsent,
    });
    if (res.error) {
      setError(res.error);
      setSaving(false);
      return;
    }
    router.push("/studio/works?tab=series");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-10 py-4">
      <div className="space-y-2">
        <Link href="/studio/works?tab=series" className="text-sm text-muted-foreground hover:text-foreground">
          ← Series
        </Link>
        <h2 className="text-xl font-semibold">Add a school folio</h2>
        <p className="text-sm text-muted-foreground">
          Photograph the whole folio, then each panel. It becomes a series on your profile, with the whole folio as the
          cover. Folios are never for sale.
        </p>
      </div>

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem_6rem]">
          <label className="space-y-1">
            <span className="block text-sm font-medium">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g. Level 3 Painting"
              className="h-11 w-full border border-border bg-card px-3 text-base outline-none focus:border-foreground"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium">Subject</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as FolioInput["subject"])}
              className="h-11 w-full border border-border bg-card px-2 text-base outline-none focus:border-foreground"
            >
              <option value="art">Art</option>
              <option value="design">Design</option>
              <option value="photography">Photography</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium">Year</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              className="h-11 w-full border border-border bg-card px-3 text-base outline-none focus:border-foreground"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">1. The whole folio (cover)</h3>
        <div className="border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">Before you upload, cover or crop out:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>Candidate numbers and NZQA labels</li>
            <li>School names, crests and uniforms</li>
            <li>Assessor notes, marks and grades</li>
          </ul>
        </div>
        {cover ? (
          <Thumb url={cover} onRemove={() => setCover(null)} />
        ) : (
          <input type="file" accept="image/*" disabled={coverBusy} onChange={(e) => addCover(e.target.files)} />
        )}
        {coverBusy && <p className="text-sm text-muted-foreground">Uploading…</p>}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">2. Each panel</h3>
        <p className="text-sm text-muted-foreground">A tri-fold has three, but add as many as you have.</p>
        <div className="flex flex-wrap gap-3">
          {urlsOf(panels).map((url, i) => (
            <Thumb key={url} url={url} onRemove={() => setPanels((p) => p.filter((_, j) => j !== i))} />
          ))}
        </div>
        <input type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files, "panel"); e.target.value = ""; }} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">3. Detail shots (optional)</h3>
        <div className="flex flex-wrap gap-3">
          {urlsOf(details).map((url, i) => (
            <Thumb key={url} url={url} onRemove={() => setDetails((p) => p.filter((_, j) => j !== i))} />
          ))}
        </div>
        <input type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files, "detail"); e.target.value = ""; }} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">4. Confirm</h3>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={identifiersCleared}
            onChange={(e) => setIdentifiersCleared(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          I&apos;ve covered or cropped out candidate numbers, school names, assessor notes and grades.
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={peopleConsent}
            onChange={(e) => setPeopleConsent(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0"
          />
          Nobody identifiable is shown unless they&apos;ve agreed to it being shared.
        </label>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={!ready || saving}
        className="h-11 bg-black px-6 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Publish folio"}
      </button>
    </form>
  );
}

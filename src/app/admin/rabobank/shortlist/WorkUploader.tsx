"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/** Shrinks big phone photos before upload so they stay under the host's request limit. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 3_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function WorkUploader({ artistId }: { artistId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    setError(null);
    fd.set("file", await shrink(file), file.name);
    fd.set("artist_id", artistId);
    const res = await fetch("/admin/rabobank/shortlist/upload", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => null))?.error ?? "Upload failed.");
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-dashed border-border p-3">
      <p className="text-sm font-medium">Add a work</p>
      <input type="file" name="file" accept="image/*" className="text-sm" required />
      <div className="grid gap-2 sm:grid-cols-4">
        <input name="title" placeholder="Title" className={input} maxLength={200} />
        <input name="size" placeholder="Size" className={input} maxLength={100} />
        <input name="year" placeholder="Year" className={input} maxLength={20} />
        <input name="medium" placeholder="Medium" className={input} maxLength={200} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button disabled={busy} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}

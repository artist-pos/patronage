export interface UploadImageOptions {
  bucket: string;
  path: string;
  maxWidth?: number;
  quality?: number;
  upsert?: boolean;
  thumb?: boolean;
  thumbPath?: string;
  thumbWidth?: number;
  thumbQuality?: number;
}

export interface UploadImageResult {
  url: string;
  thumbUrl?: string;
  width: number;
  height: number;
}

export async function uploadImage(
  file: File | Blob,
  options: UploadImageOptions
): Promise<UploadImageResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("bucket", options.bucket);
  fd.append("path", options.path);
  if (options.maxWidth != null) fd.append("maxWidth", String(options.maxWidth));
  if (options.quality != null) fd.append("quality", String(options.quality));
  if (options.upsert) fd.append("upsert", "true");
  if (options.thumb) fd.append("thumb", "true");
  if (options.thumbPath) fd.append("thumbPath", options.thumbPath);
  if (options.thumbWidth != null) fd.append("thumbWidth", String(options.thumbWidth));
  if (options.thumbQuality != null) fd.append("thumbQuality", String(options.thumbQuality));

  const res = await fetch("/api/upload/image", { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Upload failed");
  }
  return res.json() as Promise<UploadImageResult>;
}

/** Derives the thumbnail URL for a WebP upload using the -{timestamp}-thumb.webp convention. */
export function getThumbUrl(url: string): string | undefined {
  if (url.endsWith(".webp")) return url.replace(/\.webp$/, "-thumb.webp");
  return undefined;
}

import sharp from "sharp";

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Intrinsic dimensions of an encoded image, without re-encoding it. Sharp reads
 * only the header, so this is cheap enough to run over a backfill batch.
 * Returns null for anything sharp can't parse.
 */
export async function readImageSize(
  buffer: Buffer
): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height } = await sharp(buffer).metadata();
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}

export async function processImage(
  buffer: Buffer,
  options?: { maxWidth?: number; quality?: number }
): Promise<ProcessedImage> {
  const { maxWidth, quality = 90 } = options ?? {};
  let pipeline = sharp(buffer);
  if (maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  const { data, info } = await pipeline
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

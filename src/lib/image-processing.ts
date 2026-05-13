import sharp from "sharp";

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
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

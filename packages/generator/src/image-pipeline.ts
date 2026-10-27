import sharp, { type Metadata, type OutputInfo } from "sharp";

// The photo pipeline of docs/security.md (Images). Every photo a client sends goes through it
// on the server before any site uses it:
// - the format is read from the file's own bytes, never from its name or declared type, and
//   only JPEG, PNG and WebP pass (SVG and everything else are refused);
// - size and pixel count are capped (decompression bombs never get decoded);
// - the image is decoded and encoded again as WebP: EXIF (GPS included) and any other
//   metadata are dropped, and whatever was appended or hidden in the file (a "polyglot")
//   does not survive;
// - it comes out at most 2000 px on its long side, turned upright from its EXIF orientation;
// - small and blurry photos get a warning, so the client can send a better one.
// The original stays in the private bucket; only this cleaned copy is ever published.

export const IMAGE_LIMITS = {
  /** Largest file accepted. */
  maxBytes: 10 * 1024 * 1024,
  /** Largest image accepted, in pixels (about 40 megapixels). */
  maxPixels: 40_000_000,
  /** Long side of the cleaned copy. */
  maxSide: 2000,
  /** Under this long side a photo is "weak": variants show it smaller (catalog `isStrongPhoto`). */
  strongSide: 1200,
  /** Photos a gallery may hold. */
  galleryMax: 12,
} as const;

/** Under this Laplacian-based score (on a 512 px greyscale copy) a photo looks blurry. */
const BLUR_THRESHOLD = 0.5;

export type ImageFormat = "jpeg" | "png" | "webp";

/** A refused file. The message is shown to the client (pt-BR). */
export class ImageRejected extends Error {}

/** The format a file really has, from its first bytes; null for anything not accepted. */
export function sniffFormat(data: Uint8Array): ImageFormat | null {
  const starts = (bytes: number[], offset = 0) =>
    bytes.every((byte, i) => data[offset + i] === byte);
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export interface CleanImage {
  /** The cleaned copy, always WebP. */
  data: Buffer;
  width: number;
  height: number;
  /** The format the client's file really had. */
  sourceFormat: ImageFormat;
  /** Big enough to fill a wide frame. */
  strong: boolean;
  /** pt-BR notes for the client: small or blurry photo. */
  warnings: string[];
}

export async function cleanImage(input: Uint8Array): Promise<CleanImage> {
  if (input.byteLength === 0) throw new ImageRejected("O arquivo está vazio.");
  if (input.byteLength > IMAGE_LIMITS.maxBytes) {
    throw new ImageRejected("Essa foto é grande demais. Envie uma com até 10 MB.");
  }
  const sourceFormat = sniffFormat(input);
  if (!sourceFormat) {
    throw new ImageRejected("Esse arquivo não é uma foto em JPG, PNG ou WebP.");
  }

  const options = { limitInputPixels: IMAGE_LIMITS.maxPixels, failOn: "error" as const };
  let metadata: Metadata;
  try {
    metadata = await sharp(input, options).metadata();
  } catch {
    throw new ImageRejected("Não foi possível abrir essa foto. Tente outra, em JPG ou PNG.");
  }
  if (metadata.format !== sourceFormat) {
    throw new ImageRejected("Esse arquivo não é uma foto em JPG, PNG ou WebP.");
  }
  if (!metadata.width || !metadata.height) {
    throw new ImageRejected("Não foi possível ler o tamanho dessa foto.");
  }
  if (metadata.width * metadata.height > IMAGE_LIMITS.maxPixels) {
    throw new ImageRejected("Essa foto tem pixels demais. Envie uma foto menor.");
  }

  let data: Buffer;
  let info: OutputInfo;
  try {
    // sharp writes no metadata unless asked to: EXIF, GPS, XMP and ICC comments are dropped.
    ({ data, info } = await sharp(input, options)
      .rotate()
      .resize({
        width: IMAGE_LIMITS.maxSide,
        height: IMAGE_LIMITS.maxSide,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    throw new ImageRejected("Não foi possível preparar essa foto. Tente outra.");
  }

  const warnings: string[] = [];
  const strong = Math.max(info.width, info.height) >= IMAGE_LIMITS.strongSide;
  if (!strong) {
    warnings.push("A foto é pequena: ela vai aparecer em tamanho menor no site.");
  }
  const { sharpness } = await sharp(data).greyscale().resize(512, 512, { fit: "inside" }).stats();
  if (sharpness < BLUR_THRESHOLD) {
    warnings.push("A foto parece desfocada. Se tiver uma mais nítida, prefira ela.");
  }

  return { data, width: info.width, height: info.height, sourceFormat, strong, warnings };
}

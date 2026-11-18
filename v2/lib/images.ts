/**
 * Image URLs for every rendered illustration (R2 + Cloudflare Image Transformations, migrated
 * 2026-11-18, approved by Dustin).
 *
 * Stored paths stay canonical everywhere else: media.r2_key / the API's `media.url`, the theme art
 * table, the pod-ornament and state tables all keep the public path (e.g. /artwork/<file>.webp).
 * Only rendering converts them, here. Each path maps (lib/images-data.ts, generated from the
 * migration manifest) to ONE full-quality original in R2 bucket seeds-hues-images, served from our
 * own Cloudflare zone at images.seeds.hues.flowers — still self-hosted, never a third-party hotlink.
 * Sized copies are produced on the fly by /cdn-cgi/image/ transformations; the app never
 * generates image files and no w480/w768/thumbs variants exist any more.
 *
 * fit=scale-down ONLY: illustrations are always shown WHOLE with their aspect preserved — never
 * cropped (no cover/crop), never stretched, never upscaled past the original. SVGs are served as
 * stored (no transformation).
 */
import { IMAGE_KEYS } from "./images-data";

/** Public origin of the image bucket (our own zone; read-only public serving). */
export const IMAGE_ORIGIN = "https://images.seeds.hues.flowers";

/** Default transformation quality. */
export const DEFAULT_IMAGE_QUALITY = 80;

/** Largest width the app requests; above the widest original in the bucket (3200 px). */
const MAX_WIDTH = 4096;

/** A root-relative public path: one leading slash, safe segment characters, no "." / ".." segments. */
const STORED_PATH_RE = /^\/(?:[A-Za-z0-9_~-][A-Za-z0-9._~-]*\/)*[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;

function assertStoredPath(path: string): void {
  if (typeof path !== "string" || !STORED_PATH_RE.test(path) || path.split("/").some((s) => s === "." || s === "..")) {
    throw new TypeError(`lib/images: not a stored image path: ${JSON.stringify(path)}`);
  }
}

/**
 * R2 key of the original for a stored path: the manifest lookup (extensions often differ — most
 * variety artwork is stored as .webp but the original is a .png master), else the path without
 * its leading "/" (identity) for unmapped paths. Throws TypeError on anything that is not a
 * root-relative public path (a remote URL, protocol-relative URL, query string or traversal), so a
 * bad value can never be turned into a fetch through our image zone.
 */
export function originalKey(path: string): string {
  assertStoredPath(path);
  return Object.hasOwn(IMAGE_KEYS, path) ? IMAGE_KEYS[path]! : path.slice(1);
}

const isSvg = (key: string) => key.toLowerCase().endsWith(".svg");

export interface ImageUrlOptions {
  /** Target width in px (integer, 1–4096). The original is never upscaled (fit=scale-down). */
  width: number;
  /** 1–100; defaults to 80. */
  quality?: number;
}

/**
 * Transformation URL for a stored path:
 *   https://images.seeds.hues.flowers/cdn-cgi/image/width=<w>,quality=<q>,format=auto,fit=scale-down/<key>
 * format=auto serves AVIF/WebP to browsers that accept them. SVG paths bypass transformations and
 * return the plain https://images.seeds.hues.flowers/<key> URL.
 */
export function imageUrl(path: string, opts: ImageUrlOptions): string {
  const key = originalKey(path);
  if (isSvg(key)) return `${IMAGE_ORIGIN}/${key}`;
  const { width, quality = DEFAULT_IMAGE_QUALITY } = opts;
  if (!Number.isInteger(width) || width < 1 || width > MAX_WIDTH) {
    throw new RangeError(`lib/images: width must be an integer 1–${MAX_WIDTH}, got ${width}`);
  }
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
    throw new RangeError(`lib/images: quality must be an integer 1–100, got ${quality}`);
  }
  return `${IMAGE_ORIGIN}/cdn-cgi/image/width=${width},quality=${quality},format=auto,fit=scale-down/${key}`;
}

/**
 * srcset candidates "<url> <w>w, …" for the given widths (each a transformation of the same
 * original). Commas inside a /cdn-cgi/image/ URL are valid in srcset: a candidate URL runs to the
 * next whitespace. An SVG yields its single plain URL (it scales without width candidates).
 */
export function imageSrcSet(path: string, widths: readonly number[]): string {
  if (widths.length === 0) throw new RangeError("lib/images: imageSrcSet needs at least one width");
  if (isSvg(originalKey(path))) return imageUrl(path, { width: widths[0]! });
  return widths.map((width) => `${imageUrl(path, { width })} ${width}w`).join(", ");
}

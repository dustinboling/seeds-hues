/**
 * Image URLs for every rendered illustration (R2 + Cloudflare Image
 * Transformations). Ported from v2/lib/images.ts; the manifest it reads is
 * synced from v2 by scripts/sync-image-keys.mjs in a closed-world encoding
 * (png twins + overrides — behavior-identical, half the client bytes) and
 * pinned equivalent by tests/unit/image-manifest.test.ts.
 *
 * Stored paths stay canonical everywhere else; only rendering converts them,
 * here. Each path maps to ONE full-quality original in R2 bucket
 * seeds-hues-images, served from our own zone at images.seeds.hues.flowers —
 * still self-hosted, never a third-party hotlink. Sized copies are produced
 * on the fly by /cdn-cgi/image/ transformations.
 *
 * fit=scale-down ONLY: illustrations always show WHOLE with aspect preserved.
 */
import { KEY_OVERRIDES, PNG_TWIN_PATHS } from "./images-data";

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
 * R2 key of the original for a stored path: the override table first, then
 * the .png twin for listed .webp paths, else the path without its leading
 * "/" (identity) for unmapped paths. Throws on anything that is not a
 * root-relative public path, so a bad value can never be turned into a
 * fetch through our image zone.
 *
 * Closed-world encoding of v2's manifest (see images-data.ts): unlisted
 * .webp paths resolve to identity, never to a guessed .png twin — only
 * listed paths map. Resolves identically to v2's table for every v2
 * entry (pinned by tests/unit/image-manifest.test.ts).
 */
export function originalKey(path: string): string {
  assertStoredPath(path);
  if (Object.hasOwn(KEY_OVERRIDES, path)) return KEY_OVERRIDES[path]!;
  if (path.endsWith(".webp") && PNG_TWIN_PATHS.has(path)) return `${path.slice(1, -".webp".length)}.png`;
  return path.slice(1);
}

const isSvg = (key: string): boolean => key.toLowerCase().endsWith(".svg");

export interface ImageUrlOptions {
  /** Target width in px (integer, 1–4096). The original is never upscaled (fit=scale-down). */
  width: number;
  /** 1–100; defaults to 80. */
  quality?: number;
}

/**
 * Transformation URL for a stored path:
 *   https://images.seeds.hues.flowers/cdn-cgi/image/width=<w>,quality=<q>,format=auto,fit=scale-down/<key>
 * SVGs bypass transformations (plain https://images.seeds.hues.flowers/<key>).
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
 * srcset candidates "<url> <w>w, …" for the given widths. Commas inside a
 * /cdn-cgi/image/ URL are valid in srcset: a candidate URL runs to the next
 * whitespace. An SVG yields its single plain URL.
 */
export function imageSrcSet(path: string, widths: readonly number[]): string {
  if (widths.length === 0) throw new RangeError("lib/images: imageSrcSet needs at least one width");
  if (isSvg(originalKey(path))) return imageUrl(path, { width: widths[0]! });
  return widths.map((width) => `${imageUrl(path, { width })} ${width}w`).join(", ");
}

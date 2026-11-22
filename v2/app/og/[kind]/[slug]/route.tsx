/**
 * Generated Open Graph cards (S3): 1200×630 PNG via next/og ImageResponse — typography + color
 * swatch + site mark only, no photos, no external fetches (fonts bundled into the Worker).
 * Theme (THEME-ART-DIRECTION.md §4): plate-paper ground, ink title, leaf-deep accent rule and the
 * stem-and-leaves divider drawn as inline SVG shapes. The title is set in a static Fraunces instance
 * (wght 700, opsz 100; Satori cannot parse the variable TTF or WOFF2). Passing `fonts` replaces
 * next/og's built-in Geist, so the same Geist Regular file next/og ships is supplied explicitly and
 * set on the card root: eyebrow, subtitle and footer render exactly as before (Geist 400 only, so
 * the footer's fontWeight 700 still resolves to regular, as it always has).
 * The card element lives in components/og/OgCardImage (shared with the render tests); the Mixed
 * disc is SVG wedges there, since Satori cannot parse the conic gradient either.
 * VERIFICATION-LOG V13 records the runtime check and the static fallback.
 */
import { ImageResponse } from "next/og";
// Bundled as Uint8Array via experimental.turbopackImportTypeBytes (next.config.ts).
// @ts-expect-error -- TypeScript has no module declaration for .ttf bytes imports.
import frauncesOg from "@/app/fonts/fraunces-og.ttf" with { type: "bytes" };
// @ts-expect-error -- as above; this is the exact file next/og loads as its default font.
import geistRegular from "next/dist/compiled/@vercel/og/Geist-Regular.ttf" with { type: "bytes" };
import { ogCardFor } from "@/lib/seo/og-card";
import { OgCardImage } from "@/components/og/OgCardImage";

export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;

// ImageResponse's FontOptions types `data` as ArrayBuffer; copy each byte import out once at module
// scope (Satori also caches the parsed font per data object).
const toArrayBuffer = (u8: Uint8Array): ArrayBuffer =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

// Order matters: Geist first, so it stays Satori's default/fallback face for any text without an
// explicit family, as it was when next/og supplied it.
const FONTS = [
  { name: "geist", data: toArrayBuffer(geistRegular as Uint8Array), weight: 400 as const, style: "normal" as const },
  { name: "Fraunces", data: toArrayBuffer(frauncesOg as Uint8Array), weight: 700 as const, style: "normal" as const },
];

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await ctx.params;
  const card = await ogCardFor(kind, slug);
  if (!card) return new Response("Not found", { status: 404 });
  return new ImageResponse(<OgCardImage card={card} />, {
    width: W,
    height: H,
    fonts: FONTS,
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}

/**
 * Generated Open Graph cards (S3): 1200×630 PNG via next/og ImageResponse — typography + colour
 * swatch + site mark only, no photos, no external fetches (fonts bundled into the Worker).
 * Theme (THEME-ART-DIRECTION.md §4): plate-paper ground, ink title, leaf-deep accent rule and the
 * stem-and-leaves divider drawn as inline SVG shapes. The title is set in a static Fraunces instance
 * (wght 700, opsz 100; Satori cannot parse the variable TTF or WOFF2). Passing `fonts` replaces
 * next/og's built-in Geist, so the same Geist Regular file next/og ships is supplied explicitly and
 * set on the card root: eyebrow, subtitle and footer render exactly as before (Geist 400 only, so
 * the footer's fontWeight 700 still resolves to regular, as it always has).
 * VERIFICATION-LOG V13 records the runtime check and the static fallback.
 */
import { ImageResponse } from "next/og";
// Bundled as Uint8Array via experimental.turbopackImportTypeBytes (next.config.ts).
// @ts-expect-error -- TypeScript has no module declaration for .ttf bytes imports.
import frauncesOg from "@/app/fonts/fraunces-og.ttf" with { type: "bytes" };
// @ts-expect-error -- as above; this is the exact file next/og loads as its default font.
import geistRegular from "next/dist/compiled/@vercel/og/Geist-Regular.ttf" with { type: "bytes" };
import { getServices } from "@/lib/services/context";
import { shortCommonName } from "@/lib/format";

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

type Card = { eyebrow: string; title: string; subtitle: string; swatch: string | null; footer: string };

async function cardFor(kind: string, slug: string): Promise<Card | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (kind === "site") {
    return {
      eyebrow: "Flower seed directory",
      title: "Find where to buy any flower seed",
      subtitle: "Every US seller · stock as last seen · direct links",
      swatch: "#8E2A52",
      footer: "seeds.hues.flowers",
    };
  }
  const { catalog } = await getServices();
  if (kind === "variety") {
    const v = await catalog.getVariety(slug);
    if (!v) return null;
    const n = new Set(v.listings.map((l) => l.seller.slug)).size;
    return {
      eyebrow: v.plant.latinName ? `${shortCommonName(v.plant.commonName)} · ${v.plant.latinName}` : shortCommonName(v.plant.commonName),
      title: v.varietyName,
      subtitle: n === 0 ? "No seller found selling this yet" : `${n} seller${n === 1 ? "" : "s"} list it`,
      swatch: v.colorSwatch,
      footer: "seeds.hues.flowers",
    };
  }
  if (kind === "seller") {
    const s = await catalog.getSeller(slug);
    if (!s) return null;
    return {
      eyebrow: s.location ?? "Flower seed seller",
      title: s.name,
      subtitle: `${s.varietyCount} flower seed ${s.varietyCount === 1 ? "variety" : "varieties"} listed`,
      swatch: null,
      footer: "seeds.hues.flowers",
    };
  }
  if (kind === "crop") {
    const r = await catalog.getCrop(slug, { page: { offset: 0, limit: 1 } });
    if (!r) return null;
    return {
      eyebrow: r.crop.latinName ?? shortCommonName(r.crop.commonName),
      title: `${shortCommonName(r.crop.commonName)} seeds`,
      subtitle: `${r.crop.varietyCount} ${r.crop.varietyCount === 1 ? "variety" : "varieties"} · ${r.crop.varietiesWithSellers} with sellers`,
      swatch: null,
      footer: "seeds.hues.flowers",
    };
  }
  return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await ctx.params;
  const card = await cardFor(kind, slug);
  if (!card) return new Response("Not found", { status: 404 });
  const titleSize = card.title.length > 28 ? 72 : 92;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px 56px",
          background: "#F8F1E1",
          color: "#2E2A23",
          border: "1px solid #E0D5B8",
          fontFamily: "geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              border: "4px solid #97865F",
              background: card.swatch ?? "#F0E5CB",
              display: "flex",
            }}
          />
          <div style={{ display: "flex", fontSize: 34, color: "#6A5F4C" }}>{card.eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontFamily: "Fraunces", fontSize: titleSize, fontWeight: 700, color: "#2E2A23", lineHeight: 1.05, letterSpacing: -1 }}>
            {card.title}
          </div>
          <div style={{ display: "flex", width: 132, height: 8, borderRadius: 4, background: "#1E4634" }} />
          <div style={{ display: "flex", fontSize: 40, color: "#4A4438" }}>{card.subtitle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* The theme's stem-and-two-leaves divider, as shapes (same geometry as /theme/divider-stem.svg). */}
          <svg width="440" height="48" viewBox="0 0 220 24" fill="none">
            <path d="M4 12 H84" stroke="#4A4438" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
            <path d="M136 12 H216" stroke="#4A4438" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
            <path d="M110 21 C110 14 110 8 110 3" stroke="#4A4438" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
            <path d="M110 13 C103 12 98 8 97 2 C103 3 108 6 110 13 Z" fill="#7D9B76" opacity="0.85" />
            <path d="M110 13 C117 12 122 8 123 2 C117 3 112 6 110 13 Z" fill="#7D9B76" opacity="0.85" />
            <circle cx="110" cy="16.5" r="1.8" fill="#8E2A52" opacity="0.8" />
          </svg>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 30 }}>
            <div style={{ display: "flex", color: "#8E2A52", fontWeight: 700 }}>{card.footer}</div>
            <div style={{ display: "flex", color: "#6A5F4C" }}>Source + date on every listing · No checkout</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: FONTS,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}

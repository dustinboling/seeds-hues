/**
 * The Open Graph card model (S3): the card's text and color circle for a site, variety,
 * seller, or crop page. The route (app/og/[kind]/[slug]/route.tsx) renders this into the
 * 1200×630 PNG; kept here so tests can assert the card's style output without rendering.
 */
import type { CatalogService } from "@/lib/services/catalog";
import { chipBackground, resolveColorChip } from "./color-chip";
import { shortCommonName } from "./format";

export type OgCard = { eyebrow: string; title: string; subtitle: string; swatch: string | null; footer: string };

type OgCatalog = Pick<CatalogService, "getVariety" | "getSeller" | "getCrop">;

export async function buildOgCard(kind: string, slug: string, catalog: OgCatalog): Promise<OgCard | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (kind === "site") {
    return {
      eyebrow: "Flower seed directory",
      title: "Find where to buy any flower seed",
      subtitle: "Hard-to-find flower seed · stock as last seen · direct links",
      swatch: "#8E2A52",
      footer: "seeds.hues.flowers",
    };
  }
  if (kind === "variety") {
    const v = await catalog.getVariety(slug);
    if (!v) return null;
    const n = new Set(v.listings.map((l) => l.seller.slug)).size;
    return {
      eyebrow: v.plant.latinName ? `${shortCommonName(v.plant.commonName)} · ${v.plant.latinName}` : shortCommonName(v.plant.commonName),
      title: v.varietyName,
      subtitle: n === 0 ? "No seller found selling this yet" : `${n} seller${n === 1 ? "" : "s"} list it`,
      // The same resolved chip the variety page draws: Mixed renders the shared gradient,
      // a contradicting swatch falls back to its family, unfiled draws the neutral ground.
      swatch: chipBackground(resolveColorChip({ colorFamily: v.colorFamily, colorSwatch: v.colorSwatch })),
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

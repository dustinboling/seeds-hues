/**
 * Generated OG card copy: the text content and color circle of the
 * /og/{kind}/{slug} cards, without rendering the PNG. Ported from
 * v2/lib/seo/og-card.ts. buildOgCard is the injectable core; the route
 * passes the catalog reads. Kinds: variety, seller, crop, site
 * (site/default is the fallback card).
 */
import { chipBackground, MIX_WEDGE_HEXES, resolveColorChip } from "../lib/color-chip";
import { shortCommonName } from "../lib/format";
import { zeroSellerSentence } from "../lib/zero-seller";
import type { ApiCrop, ApiOgSeller, ApiVarietyDetail } from "../data/types";

export type OgCard = {
  eyebrow: string;
  title: string;
  subtitle: string;
  swatch: string | null;
  footer: string;
  /**
   * The Mixed disc wedges (Satori cannot parse the conic gradient in
   * `swatch`, so the route draws these flat hexes as inline SVG instead).
   * Set exactly when the variety resolves to the Mixed gradient; null on
   * every other card.
   */
  mixWedges: readonly string[] | null;
};

export interface OgCardCatalog {
  getVarietyDetail: (slug: string) => Promise<ApiVarietyDetail | null>;
  ogSeller: (slug: string) => Promise<ApiOgSeller | null>;
  ogCrop: (slug: string) => Promise<ApiCrop | null>;
}

export async function buildOgCard(kind: string, slug: string, catalog: OgCardCatalog): Promise<OgCard | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (kind === "site") {
    return {
      eyebrow: "Flower seed directory",
      title: "Find where to buy any flower seed",
      subtitle: "Hard-to-find flower seed · stock as last seen · direct links",
      swatch: "#8E2A52",
      footer: "seeds.hues.flowers",
      mixWedges: null,
    };
  }
  if (kind === "variety") {
    const v = await catalog.getVarietyDetail(slug);
    if (!v) return null;
    const n = new Set(v.listings.map((l) => l.seller.slug)).size;
    // The same resolved chip the variety page draws: Mixed renders the shared gradient,
    // a contradicting swatch falls back to its family, unfiled draws the neutral ground.
    const chip = resolveColorChip({ colorFamily: v.colorFamily, colorSwatch: v.colorSwatch });
    return {
      eyebrow: v.plant.latinName ? `${shortCommonName(v.plant.commonName)} · ${v.plant.latinName}` : shortCommonName(v.plant.commonName),
      title: v.varietyName,
      subtitle: n === 0 ? zeroSellerSentence(v.varietyName) : `${n} seller${n === 1 ? "" : "s"} list it`,
      swatch: chipBackground(chip),
      footer: "seeds.hues.flowers",
      mixWedges: chip.kind === "gradient" ? MIX_WEDGE_HEXES : null,
    };
  }
  if (kind === "seller") {
    const s = await catalog.ogSeller(slug);
    if (!s) return null;
    return {
      eyebrow: s.location ?? "Flower seed seller",
      title: s.name,
      subtitle: `${s.varietyCount} flower seed ${s.varietyCount === 1 ? "variety" : "varieties"} listed`,
      swatch: null,
      footer: "seeds.hues.flowers",
      mixWedges: null,
    };
  }
  if (kind === "crop") {
    const r = await catalog.ogCrop(slug);
    if (!r) return null;
    return {
      eyebrow: r.latinName ?? shortCommonName(r.commonName),
      title: `${shortCommonName(r.commonName)} seeds`,
      subtitle: `${r.varietyCount} ${r.varietyCount === 1 ? "variety" : "varieties"} · ${r.varietiesWithSellers} with sellers`,
      swatch: null,
      footer: "seeds.hues.flowers",
      mixWedges: null,
    };
  }
  return null;
}

/**
 * Slice 8 parity snapshot: the recorded live-site response set the crawl
 * compares the built app against, URL by URL (status, Location, canonical,
 * title, meta description, robots, JSON-LD type set).
 *
 * Provenance, by row class (stated per row in `proof`):
 * - `live`: recorded from the live site 2026-11-25 (static pages, machine
 *   files, redirect codes, handler shapes) — byte-exact expectations.
 * - `rule`: restated from v2's measured builders (v2/lib/seo/metadata.ts,
 *   v2/lib/seo/jsonld.ts, v2/lib/paging.ts, v2/lib/format.ts) + Bea's
 *   audit contracts, instantiated with the parity catalog's fixture data.
 *   Restated, never imported from src/ — the snapshot is the spec, not
 *   the app under test.
 * - `delta`: rows where the app intentionally differs from live (the ruled
 *   deltas: 301-uniform redirects, the §4.1 ?page=1 port requirement, the
 *   m-3 utm_source rename) — the app value is asserted, the live value
 *   and ruling recorded beside it.
 */
import type { FakeCatalogState } from "../unit/fake-catalog";
import type { ApiVarietyDetail, ApiVarietyListItem } from "../../src/data/types";

export const SITE = "https://seeds.hues.flowers";

export interface SnapshotRow {
  url: string;
  status: number;
  /** Exact Location for redirects. */
  location?: string;
  /** Exact canonical href; null = must be absent. Undefined = not compared (non-HTML). */
  canonical?: string | null;
  title?: string;
  description?: string | null;
  /** Exact robots meta; null = must be absent. */
  robots?: string | null;
  /** Top-level JSON-LD @types (sorted compare). */
  types?: string[];
  proof: "live" | "rule" | "delta";
  /** The live value + ruling, on delta rows. */
  delta?: string;
}

/* ── Restated v2 rules (v2/lib/format.ts, v2/lib/paging.ts — measured) ── */

const shortCommon = (common: string): string => common.split(" / ")[0] ?? common;

const proseCommon = (common: string): string => {
  const [first, ...rest] = common.split(" / ");
  return rest.length > 0 ? `${first} (${rest.join(", ")})` : (first ?? common);
};

const pageSuffix = (page: number): string => (page > 1 ? ` — page ${page}` : "");

const docTitle = (base: string): string => `${base} | seeds.hues.flowers`;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const friendlyDate = (value: string | null): string | null => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return `${MONTH_SHORT[Number(m[2]) - 1]} ${Number(m[3])}, ${Number(m[1])}`;
};

/* ── Restated description composers (v2/lib/seo/metadata.ts — measured) ── */

const SENTENCE_ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "st", "ave", "blvd", "rd",
  "co", "inc", "ltd", "corp", "llc", "jr", "sr", "vs", "no", "nos",
  "fig", "p", "pp", "vol", "dept", "est", "approx",
  "ft", "in", "oz", "lb", "lbs", "yd", "gal", "qt", "pt", "tbsp", "tsp", "fl",
]);

const CLOSING_MARKS = new Set(['"', "'", "”", "’", ")", "]"]);

function firstSentence(prose: string): string | null {
  const t = prose.replace(/\s+/g, " ").trim();
  if (!t) return null;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (ch === "." && i > 0 && i + 1 < t.length && /\d/.test(t[i - 1]!) && /\d/.test(t[i + 1]!)) continue;
    if (ch === ".") {
      const word = /([A-Za-z]+)$/.exec(t.slice(0, i))?.[1]?.toLowerCase();
      if (word && SENTENCE_ABBREVIATIONS.has(word)) continue;
    }
    let j = i + 1;
    while (j < t.length && (t[j] === "." || t[j] === "!" || t[j] === "?")) j++;
    while (j < t.length && CLOSING_MARKS.has(t[j]!)) j++;
    if (j < t.length && t[j] !== " ") continue;
    return t.slice(0, j);
  }
  return `${t}.`;
}

const DESCRIPTION_MAX = 160;
const DIRECTORY_CLAUSE = "Sellers list packet sizes in the Seed Directory.";
const HONESTY_CLAUSE = "No US sellers currently list this variety. Join the waitlist.";
const EACH_LISTING_CLOSING = "Each listing links out to buy.";
const ZERO_SELLER_TITLE = "No Seller Found Yet";

function varietyTitleText(v: {
  varietyName: string;
  plant: { commonName: string };
  listings: { seller: { slug: string } }[];
}): string {
  const n = new Set(v.listings.map((l) => l.seller.slug)).size;
  const count = n === 0 ? ZERO_SELLER_TITLE : `${n} Seller${n === 1 ? "" : "s"}`;
  return `${v.varietyName} ${shortCommon(v.plant.commonName)} Seeds — Where to Buy (${count})`;
}

function varietyDescriptionText(v: {
  varietyName: string;
  plant: { commonName: string; latinName: string | null };
  description: string | null;
  listings: { seller: { slug: string }; packetSizes: { seedCount: number | null }[] }[];
}): string {
  const crop = shortCommon(v.plant.commonName);
  const lastWord = (s: string): string => s.trim().split(/\s+/).at(-1) ?? "";
  const head = `${v.varietyName}${lastWord(v.varietyName).toLowerCase() === lastWord(crop).toLowerCase() ? "" : ` ${crop}`} seeds`;
  const headBlock = `${head}${v.plant.latinName ? ` (${v.plant.latinName})` : ""}.`;
  const sellers = new Set(v.listings.map((l) => l.seller.slug)).size;
  const prose = v.description ? firstSentence(v.description) : null;
  const joined = (...parts: string[]): string => parts.join(" ");
  const clip = (text: string): string => {
    const t = text.replace(/\s+/g, " ").trim();
    if (t.length <= DESCRIPTION_MAX) return t;
    const cut = t.slice(0, DESCRIPTION_MAX - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), DESCRIPTION_MAX - 20)).trim()}…`;
  };
  if (sellers === 0) {
    const base = joined(headBlock, HONESTY_CLAUSE);
    if (prose && joined(base, prose).length <= DESCRIPTION_MAX) return clip(joined(base, prose));
    return clip(base);
  }
  if (prose && joined(headBlock, prose).length <= DESCRIPTION_MAX) {
    const base = joined(headBlock, prose);
    if (joined(base, DIRECTORY_CLAUSE).length <= DESCRIPTION_MAX) return clip(joined(base, DIRECTORY_CLAUSE));
    return clip(base);
  }
  const count = `Listed by ${sellers} US seller${sellers === 1 ? "" : "s"} in the Seed Directory.`;
  const base = joined(headBlock, count);
  const seedCounts = v.listings.flatMap((l) => l.packetSizes.map((p) => p.seedCount).filter((n): n is number => n !== null));
  if (seedCounts.length > 0) {
    const min = Math.min(...seedCounts);
    const max = Math.max(...seedCounts);
    const range = min === max ? `Packets of ${min} seeds.` : `Packets from ${min} to ${max} seeds.`;
    if (joined(base, range, EACH_LISTING_CLOSING).length <= DESCRIPTION_MAX) return clip(joined(base, range, EACH_LISTING_CLOSING));
  }
  if (joined(base, DIRECTORY_CLAUSE).length <= DESCRIPTION_MAX) return clip(joined(base, DIRECTORY_CLAUSE));
  return clip(base);
}

function sellerDescriptionText(s: { name: string; location: string | null; varietyCount: number; description: string | null }): string {
  const where = s.location ? ` in ${s.location}` : "";
  const head = `${s.name}${where}: ${s.varietyCount} flower seed ${s.varietyCount === 1 ? "variety" : "varieties"} listed, each with its stock state and the date it was last checked.`;
  const prose = s.description ? firstSentence(s.description) : null;
  if (prose && `${head} ${prose}`.length <= DESCRIPTION_MAX) return `${head} ${prose}`;
  return head;
}

function cropDescriptionText(c: {
  varietyCount: number;
  commonName: string;
  latinName: string | null;
  varietiesWithSellers: number;
  lastUpdated: string | null;
}): string {
  const date = friendlyDate(c.lastUpdated);
  return `${c.varietyCount === 1 ? "1 variety" : `${c.varietyCount} varieties`} of ${proseCommon(c.commonName)}${c.latinName ? ` (${c.latinName})` : ""} cataloged; ${c.varietiesWithSellers} sold by sellers in the directory.${date ? ` Last updated ${date}.` : ""}`;
}

function seriesTitleText(s: { name: string; cropCommonName: string; varietyCount: number; varietiesWithSellers: number }): string {
  return `${s.name} ${shortCommon(s.cropCommonName)} Series — ${s.varietyCount === 1 ? "1 Variety" : `${s.varietyCount} Varieties`}, ${s.varietiesWithSellers} With Sellers`;
}

function seriesDescriptionText(s: {
  name: string;
  cropCommonName: string;
  latinName: string | null;
  varietyCount: number;
  varietiesWithSellers: number;
}): string {
  return `The ${s.name} series of ${proseCommon(s.cropCommonName)}${s.latinName ? ` (${s.latinName})` : ""}: ${s.varietyCount === 1 ? "1 variety" : `${s.varietyCount} varieties`} cataloged, ${s.varietiesWithSellers} sold by sellers in the directory.`;
}

function cropDetailTitleText(c: {
  commonName: string;
  latinName: string | null;
  varietyCount: number;
  varietiesWithSellers: number;
}): string {
  return `${shortCommon(c.commonName)} Seeds${c.latinName ? ` (${c.latinName})` : ""} — ${c.varietyCount === 1 ? "1 Variety" : `${c.varietyCount} Varieties`}, ${c.varietiesWithSellers} With Sellers`;
}

function stateDescriptionText(st: { name: string; sellerCount: number }): string {
  const n = st.sellerCount;
  return `${n} ${n === 1 ? "farm or seed company" : "farms and seed companies"} in ${st.name} ${n === 1 ? "lists" : "list"} flower seed with the Seed Directory, with the varieties each one carries and when each listing was last checked.`;
}

/* ── Live-recorded static/utility heads (fetched 2026-11-25, US spelling as shipped) ── */

const LIVE_STATIC: Record<string, { title: string; absolute?: boolean; description: string; robots: string; types: string[] }> = {
  "/": {
    title: "seeds.hues.flowers — Find Where to Buy Any Flower Seed",
    absolute: true,
    description:
      "Search a hard-to-find variety, see US sellers who have it — with stock state as last seen, the date each listing was checked, and a direct link to the seller.",
    robots: "index, follow",
    types: ["Organization", "WebSite"],
  },
  "/about": {
    title: "About the directory",
    description:
      "What seeds.hues.flowers is, which sellers are listed, how ratings work, and how sellers can correct, claim or remove their listings.",
    robots: "index, follow",
    types: [],
  },
  "/about/data": {
    title: "About the data",
    description:
      "How the directory collects listings, which US sellers are listed, the source and date on every listing, how to opt out, and who owns the site.",
    robots: "index, follow",
    types: [],
  },
  "/about/bot": {
    title: "Our crawler (HuesSeedFinderBot)",
    description:
      "Identity, robots.txt compliance, rate limits and opt-out instructions for HuesSeedFinderBot, the seeds.hues.flowers crawler.",
    robots: "index, follow",
    types: [],
  },
  "/api-docs": {
    title: "Public API (v1)",
    description:
      "JSON API for the seeds.hues.flowers catalogue: crops, varieties, series, sellers, listings, search, coverage, sync and catalog snapshots. OpenAPI 3.1.",
    robots: "index, follow",
    types: [],
  },
  "/privacy": {
    title: "Privacy",
    description: "What seeds.hues.flowers collects (very little), why, and what it never collects.",
    robots: "index, follow",
    types: [],
  },
  "/terms": {
    title: "Terms of use",
    description: "Terms for using the seeds.hues.flowers directory and its read-only API.",
    robots: "index, follow",
    types: [],
  },
  "/add-your-farm": {
    title: "Add Your Farm",
    description:
      "Sell flower seed in the US, from a farm or a seed company of any size? Add your seller to the Seed Directory — free, reviewed by hand, never pay-for-placement.",
    robots: "index, follow",
    types: [],
  },
  "/report": {
    title: "Report a problem, claim or remove a seller",
    // Live reads "honoured"; the port ships the program's ruled US
    // spelling ("honored", Slice 2 decision, gate-blessed, test-pinned).
    description: "Correct a listing, claim your seller page, or ask us to remove it. Removals are honored within 48 hours.",
    robots: "noindex, follow",
    types: [],
  },
  "/account": {
    title: "Your account",
    description: "Sign in or create a Seed Directory account to join waiting lists and get an alert when a variety is found.",
    robots: "noindex, follow",
    types: [],
  },
  "/unsubscribe": {
    title: "Unsubscribe",
    description: "Stop Seed Directory waiting-list alerts for one variety or for everything.",
    robots: "noindex, nofollow",
    types: [],
  },
  "/offline": {
    title: "You’re offline",
    description: "This page isn’t saved on your device yet.",
    robots: "noindex, follow",
    types: [],
  },
};

/** State code → [name, slug]. Restated (USPS + the directory's slugs), never imported. */
const STATES: Record<string, [string, string]> = {
  OR: ["Oregon", "oregon"],
  KS: ["Kansas", "kansas"],
  TX: ["Texas", "texas"],
  VT: ["Vermont", "vermont"],
  OH: ["Ohio", "ohio"],
};

const VARIETY_BROWSE_DESCRIPTION =
  "Every flower seed variety in the directory, alphabetical, with how many sellers list it and when each listing was last checked.";
const SELLER_BROWSE_DESCRIPTION =
  "US farms and seed companies of every size that sell flower seed, with the varieties each one carries and when each listing was last checked.";
const SEARCH_DESCRIPTION = "Search flower seed varieties, crops, series and sellers by any name a variety goes by.";
const CROP_INDEX_DESCRIPTION = "Every crop in the directory with how many varieties are cataloged.";

/**
 * Deltas outside the per-URL compare set, recorded for the crawl report
 * (each ruled or evidenced — none silent).
 */
export const OUT_OF_SCOPE_DELTAS: { surface: string; live: string; app: string; ruling: string }[] = [
  {
    surface: "sitemap shape",
    live: "single /sitemap.xml urlset (1,144 URLs incl. ?page=N, recorded 2026-11-25)",
    app: "segmented index + 7 Bea §8.2 files, pagination excluded",
    ruling: "Bea §8.2 + audit m-1 (port requirement)",
  },
  {
    surface: "hub sitemap membership",
    live: "/add-your-farm absent from the single-file sitemap",
    app: "/add-your-farm present in sitemap-hubs.xml",
    ruling: "Bea §8.2 hubs table (the deliberate +1, recorded in sitemap.ts)",
  },
  {
    surface: "crop og:image",
    live: "portrait 1120×2240 artwork URL on crops with media (e.g. /crop/ageratum)",
    app: "generated 1200×630 /og/crop/{slug} card on every crop hub",
    ruling: "Bea §11 item 3 (audit m-2 port item)",
  },
  {
    surface: "home Organization keys",
    live: "no logo/sameAs keys",
    app: "logo + sameAs ([hues.flowers])",
    ruling: "Bea §11 item 2 (verified URLs only — nothing invented)",
  },
  {
    surface: "404 document title",
    live: "the home title (Next default-metadata fallthrough — v2/app/not-found.tsx sets no title)",
    app: "Page not found | seeds.hues.flowers",
    ruling: "App chrome kept (prior slices + gates; needs Bea ruling at Slice 9 if exactness is required)",
  },
  {
    surface: "admin gate status",
    live: "307 (Next redirect())",
    app: "303 throughout",
    ruling: "Observed only — auth chrome, robots-disallowed, Slice 7 gate-blessed; out of SEO parity scope",
  },
  {
    surface: "US-spelling normalization",
    live: "honoured/honouring (report description, /about, /about/bot, /terms, llms.txt)",
    app: "honored/honoring throughout",
    ruling: "Standing US-spelling constraint (this dispatch + Slice 2 decision, gate-blessed, pinned in slice2-surface)",
  },
];

/** Every crawled URL with its expected app response (+ the live value on delta rows). */
export function buildSnapshot(state: FakeCatalogState): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  const push = (row: SnapshotRow): void => {
    if (rows.some((r) => r.url === row.url)) throw new Error(`snapshot: duplicate URL ${row.url}`);
    rows.push(row);
  };

  /* ── A. Segmented-sitemap URLs (every canonical URL in the dataset) ── */

  // Varieties: detail-backed where the API serves a detail, list-row
  // fallback where it cannot (the fallback rows go red until the reads
  // exist — the sitemap-404 class this crawl exists to catch).
  const snapshotVarieties = state.snapshot.varieties.filter((v) => v.indexable);
  for (const v of snapshotVarieties) {
    const detail: ApiVarietyDetail | undefined = state.details[v.slug];
    const item: ApiVarietyListItem | undefined = state.listItems.find((i) => i.slug === v.slug);
    if (detail) {
      // Zero-seller pages emit the EMPTY sellers ItemList — Bea §1.1's
      // "empty list / omitted" resolved by live behavior (recorded
      // 2026-11-25: numberOfItems 0), matched exactly by the port.
      push({
        url: `/variety/${v.slug}`,
        status: 200,
        canonical: `${SITE}/variety/${v.slug}`,
        title: docTitle(varietyTitleText(detail)),
        description: varietyDescriptionText(detail),
        robots: "index, follow",
        types: ["BreadcrumbList", "ItemList"],
        proof: "rule",
      });
    } else if (item) {
      push({
        url: `/variety/${v.slug}`,
        status: 200,
        canonical: `${SITE}/variety/${v.slug}`,
        title: docTitle(
          `${item.varietyName} ${shortCommon(item.plant.commonName)} Seeds — Where to Buy (${item.sellerCount === 0 ? ZERO_SELLER_TITLE : `${item.sellerCount} Seller${item.sellerCount === 1 ? "" : "s"}`})`,
        ),
        robots: "index, follow",
        types: ["BreadcrumbList", "ItemList"],
        proof: "rule",
      });
    }
  }

  // Sellers (page 1 in the sitemap; page 2 rows join the pagination tails).
  const snapshotSellers = state.snapshot.sellers.slice().sort((a, b) => (a.slug < b.slug ? -1 : 1));
  for (const s of snapshotSellers) {
    const detail = state.sellerDetails[s.slug];
    if (!detail) throw new Error(`snapshot: no seller detail for sitemap seller ${s.slug}`);
    push({
      url: `/seller/${s.slug}`,
      status: 200,
      canonical: `${SITE}/seller/${s.slug}`,
      title: docTitle(`${detail.name} — Flower Seed Seller`),
      description: sellerDescriptionText(detail),
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList", "Organization"],
      proof: "rule",
    });
  }

  // Crops.
  for (const c of state.snapshot.crops) {
    const crop = state.crops.find((k) => k.slug === c.slug);
    if (!crop) throw new Error(`snapshot: no crop fixture for sitemap crop ${c.slug}`);
    push({
      url: `/crop/${c.slug}`,
      status: 200,
      canonical: `${SITE}/crop/${c.slug}`,
      title: docTitle(`${cropDetailTitleText(crop)}${pageSuffix(1)}`),
      description: cropDescriptionText(crop),
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }

  // Series (full grid, unpaginated — counts from the served member set).
  for (const s of state.snapshot.series) {
    const seed = state.seriesCatalog.find((k) => k.slug === s.slug);
    const crop = seed ? state.crops.find((k) => k.slug === seed.plantSlug) : undefined;
    if (!seed || !crop) throw new Error(`snapshot: no series fixture for sitemap series ${s.slug}`);
    const members = state.listItems.filter((i) => i.series?.slug === seed.slug);
    const withSellers = members.filter((m) => m.listingCount > 0).length;
    push({
      url: `/series/${s.slug}`,
      status: 200,
      canonical: `${SITE}/series/${s.slug}`,
      title: docTitle(
        seriesTitleText({ name: seed.name, cropCommonName: crop.commonName, varietyCount: members.length, varietiesWithSellers: withSellers }),
      ),
      description: seriesDescriptionText({
        name: seed.name,
        cropCommonName: crop.commonName,
        latinName: crop.latinName,
        varietyCount: members.length,
        varietiesWithSellers: withSellers,
      }),
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }

  // States (visible-seller regions only — Bea §0.2).
  const regions = new Set(
    state.snapshot.sellers.filter((s) => s.country === "US").map((s) => s.region).filter((r): r is string => r !== null),
  );
  for (const region of [...regions].sort()) {
    const [name, slug] = STATES[region] ?? ([] as unknown as [string, string]);
    if (!name || !slug) throw new Error(`snapshot: unknown state region ${region}`);
    const sellerCount = state.sellers.filter((s) => s.region === region).length;
    push({
      url: `/state/${slug}`,
      status: 200,
      canonical: `${SITE}/state/${slug}`,
      title: `Seed sellers in ${name} — Seed Directory`,
      description: stateDescriptionText({ name, sellerCount }),
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }

  // Hubs.
  const hubs: SnapshotRow[] = [
    { url: "/", status: 200, canonical: SITE, title: LIVE_STATIC["/"]!.title, description: LIVE_STATIC["/"]!.description, robots: "index, follow", types: ["Organization", "WebSite"], proof: "live" },
    { url: "/crop", status: 200, canonical: `${SITE}/crop`, title: docTitle("Flower seed crops"), description: CROP_INDEX_DESCRIPTION, robots: "index, follow", types: ["BreadcrumbList", "ItemList"], proof: "live" },
    { url: "/variety", status: 200, canonical: `${SITE}/variety`, title: docTitle("All flower seed varieties"), description: VARIETY_BROWSE_DESCRIPTION, robots: "index, follow", types: ["BreadcrumbList", "ItemList"], proof: "live" },
    { url: "/seller", status: 200, canonical: `${SITE}/seller`, title: docTitle("Flower seed sellers"), description: SELLER_BROWSE_DESCRIPTION, robots: "index, follow", types: ["BreadcrumbList", "ItemList"], proof: "live" },
  ];
  for (const path of ["/about", "/about/data", "/about/bot", "/api-docs", "/terms", "/privacy", "/add-your-farm"] as const) {
    const live = LIVE_STATIC[path]!;
    hubs.push({
      url: path,
      status: 200,
      canonical: `${SITE}${path}`,
      title: docTitle(live.title),
      description: live.description,
      robots: live.robots,
      types: [],
      proof: "live",
    });
  }
  for (const hub of hubs) push(hub);

  /* ── B. §8.4 redirect rows (app 301-uniform; live 308 — ruled delta) ── */

  const redirect = (url: string, location: string): void =>
    push({ url, status: 301, location, proof: "delta", delta: "301-uniform (live 308; Bea §8.4 recommendation, ruled delta)" });
  redirect("/varieties", "/variety");
  redirect("/varieties/sweet-pea-kings-ransom", "/variety/sweet-pea-kings-ransom");
  redirect("/sellers", "/seller");
  redirect("/sellers/blue-ridge-seeds", "/seller/blue-ridge-seeds");
  redirect("/plants", "/crop");
  redirect("/plants/sunflower", "/crop/sunflower");
  redirect("/categories", "/crop");
  redirect("/categories/sunflower", "/crop");
  redirect("/variety?v=sweet-pea-kings-ransom", "/variety/sweet-pea-kings-ransom");
  redirect("/seller?s=blue-ridge-seeds", "/seller/blue-ridge-seeds");
  redirect("/variety/sweet-pea-kings-ransom/small-farms", "/variety/sweet-pea-kings-ransom?small_farm=true");
  redirect("/variety/sweet-pea-kings-ransom/waitlist", "/variety/sweet-pea-kings-ransom");
  for (const [slug, target] of Object.entries(state.merged)) {
    redirect(`/variety/${slug}`, `/variety/${target}`);
    redirect(`/variety/${slug}?small_farm=true`, `/variety/${target}?small_farm=true`);
  }

  /* ── C. ?page=1 rows (new port behavior; live renders 200) ── */

  for (const clean of ["/variety", "/seller", "/seller/blue-ridge-seeds", "/crop/sunflower", "/state/ohio"]) {
    push({
      url: `${clean}?page=1`,
      status: 301,
      location: clean,
      proof: "delta",
      delta: "§4.1 port requirement (live renders page 1 with a clean canonical; the redirect is new)",
    });
  }

  /* ── D. Trailing-slash rows (app 301; live 308 — ruled delta) ── */

  redirect("/crop/", "/crop");
  redirect("/about/", "/about");
  redirect("/variety/sweet-pea-kings-ransom/", "/variety/sweet-pea-kings-ransom");
  redirect("/seller/blue-ridge-seeds/", "/seller/blue-ridge-seeds");

  /* ── E. Pagination tails ── */

  const varietyPages = Math.ceil(state.listItems.length / 24);
  for (let page = 2; page <= varietyPages; page++) {
    push({
      url: `/variety?page=${page}`,
      status: 200,
      canonical: `${SITE}/variety?page=${page}`,
      title: docTitle(`All flower seed varieties${pageSuffix(page)}`),
      description: VARIETY_BROWSE_DESCRIPTION,
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }
  const sellerPages = Math.ceil(state.sellers.length / 24);
  for (let page = 2; page <= sellerPages; page++) {
    push({
      url: `/seller?page=${page}`,
      status: 200,
      canonical: `${SITE}/seller?page=${page}`,
      title: docTitle(`Flower seed sellers${pageSuffix(page)}`),
      description: SELLER_BROWSE_DESCRIPTION,
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }
  // Shop page 2 (Blue Ridge, 30 listings) — the Slice 5 residual's shop half.
  {
    const detail = state.sellerDetails["blue-ridge-seeds"]!;
    push({
      url: "/seller/blue-ridge-seeds?page=2",
      status: 200,
      canonical: `${SITE}/seller/blue-ridge-seeds?page=2`,
      title: docTitle(`${detail.name} — Flower Seed Seller${pageSuffix(2)}`),
      description: sellerDescriptionText(detail),
      robots: "index, follow",
      types: ["BreadcrumbList", "ItemList", "Organization"],
      proof: "rule",
    });
  }
  // Crop page 2s (every crop hub with > 24 members) — the crop half.
  for (const crop of state.crops) {
    const members = state.listItems.filter((i) => i.plant.slug === crop.slug).length;
    if (members > 24) {
      push({
        url: `/crop/${crop.slug}?page=2`,
        status: 200,
        canonical: `${SITE}/crop/${crop.slug}?page=2`,
        title: docTitle(`${cropDetailTitleText(crop)}${pageSuffix(2)}`),
        description: cropDescriptionText(crop),
        robots: "index, follow",
        types: ["BreadcrumbList", "ItemList"],
        proof: "rule",
      });
    }
  }
  // State page 2 (Ohio, 25 sellers) — the Slice 5 residual risk, closed here.
  push({
    url: "/state/ohio?page=2",
    status: 200,
    canonical: `${SITE}/state/ohio?page=2`,
    title: "Seed sellers in Ohio — Seed Directory — page 2",
    description: stateDescriptionText({ name: "Ohio", sellerCount: 25 }),
    robots: "index, follow",
    types: ["BreadcrumbList", "ItemList"],
    proof: "rule",
  });
  // Series ignores paging (Slice 5: full grid, ?page= ignored with a 200).
  push({
    url: "/series/sunbeam?page=2",
    status: 200,
    canonical: `${SITE}/series/sunbeam`,
    title: docTitle(
      seriesTitleText({ name: "Sunbeam", cropCommonName: "Sunflower", varietyCount: 8, varietiesWithSellers: 8 }),
    ),
    description: seriesDescriptionText({
      name: "Sunbeam",
      cropCommonName: "Sunflower",
      latinName: "Helianthus annuus",
      varietyCount: 8,
      varietiesWithSellers: 8,
    }),
    robots: "index, follow",
    types: ["BreadcrumbList", "ItemList"],
    proof: "rule",
  });
  // Out-of-range pages are true 404s.
  for (const url of [
    "/variety?page=99",
    "/variety?page=0",
    "/variety?page=abc",
    "/seller?page=99",
    "/seller/blue-ridge-seeds?page=3",
    "/seller/quiet-hollow-farm?page=2",
    "/crop/testbloom?page=2",
    "/state/ohio?page=3",
    "/state/oregon?page=2",
  ]) {
    push({ url, status: 404, canonical: null, title: docTitle("Page not found"), robots: "noindex", types: [], proof: "rule" });
  }

  /* ── F. Filtered noindex views + utility pages ── */

  push({
    url: "/variety?color_family=pink",
    status: 200,
    canonical: `${SITE}/variety`,
    title: docTitle("Pink — flower seed varieties"),
    description: VARIETY_BROWSE_DESCRIPTION,
    robots: "noindex, follow",
    types: ["BreadcrumbList", "ItemList"],
    proof: "rule",
  });
  push({
    url: "/variety?sort=recent",
    status: 200,
    canonical: `${SITE}/variety`,
    title: docTitle("All flower seed varieties"),
    description: VARIETY_BROWSE_DESCRIPTION,
    robots: "index, follow",
    types: ["BreadcrumbList", "ItemList"],
    proof: "rule",
  });
  {
    const crop = state.crops.find((k) => k.slug === "sunflower")!;
    push({
      url: "/crop/sunflower?has_sellers=true",
      status: 200,
      canonical: `${SITE}/crop/sunflower`,
      title: docTitle(cropDetailTitleText(crop)),
      description: cropDescriptionText(crop),
      robots: "noindex, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }
  push({
    url: "/seller?state=OR",
    status: 200,
    canonical: `${SITE}/seller`,
    title: docTitle("Seed sellers in Oregon"),
    description: SELLER_BROWSE_DESCRIPTION,
    robots: "noindex, follow",
    types: ["BreadcrumbList", "ItemList"],
    proof: "rule",
  });
  {
    const detail = state.details["sweet-pea-kings-ransom"]!;
    push({
      url: "/variety/sweet-pea-kings-ransom?small_farm=true",
      status: 200,
      canonical: `${SITE}/variety/sweet-pea-kings-ransom`,
      title: docTitle(varietyTitleText(detail)),
      description: varietyDescriptionText(detail),
      robots: "noindex, follow",
      types: ["BreadcrumbList", "ItemList"],
      proof: "rule",
    });
  }
  push({
    url: "/search",
    status: 200,
    canonical: `${SITE}/search`,
    title: docTitle("Search flower seeds"),
    description: SEARCH_DESCRIPTION,
    robots: "noindex, follow",
    types: [],
    proof: "live",
  });
  push({
    url: "/search?q=sweet+pea",
    status: 200,
    canonical: `${SITE}/search`,
    title: docTitle("Search: sweet pea"),
    description: SEARCH_DESCRIPTION,
    robots: "noindex, follow",
    types: [],
    proof: "live",
  });
  for (const path of ["/report", "/account", "/unsubscribe", "/offline"] as const) {
    const live = LIVE_STATIC[path]!;
    push({
      url: path,
      status: 200,
      canonical: `${SITE}${path}`,
      title: docTitle(live.title),
      description: live.description,
      robots: live.robots,
      types: [],
      proof: path === "/report" ? "delta" : "live",
      ...(path === "/report" ? { delta: "US-spelling normalization (program rule; live 'honoured')" } : {}),
    });
  }

  /* ── G. Error + handler probes ── */

  for (const url of [
    "/no-such-page",
    "/Variety",
    "/variety/definitely-not-a-variety",
    "/variety/ABC",
    "/seller/no-such-seller-zzz",
    "/seller/two-roads-farm/austin",
    "/crop/not-a-crop",
    "/series/no-such-series",
    "/state/not-a-state",
    "/state/california",
    "/about/nope",
  ]) {
    push({ url, status: 404, canonical: null, title: docTitle("Page not found"), robots: "noindex", types: [], proof: "rule" });
  }
  push({
    url: "/seller/shuttered-seed-co",
    status: 410,
    canonical: null,
    title: docTitle("Seller removed"),
    robots: "noindex",
    types: [],
    proof: "live",
  });
  push({
    url: "/go/1",
    status: 302,
    location: "https://shop.example.com/blue-ridge/kings-ransom?utm_source=seed-directory&utm_medium=referral",
    proof: "delta",
    delta: "m-3 utm_source rename (backend still composes seedfinder; the app ships seed-directory)",
  });
  push({
    url: "/go/3",
    status: 302,
    location: "https://shop.example.com/blue-ridge/kings-ransom?color=red&utm_source=seed-directory&utm_medium=referral",
    proof: "delta",
    delta: "m-3 utm_source rename (target query preserved)",
  });
  push({
    url: "/go/4",
    status: 302,
    location: "https://shop.example.com/blue-ridge/kings-ransom?utm_source=newsletter&utm_medium=referral",
    proof: "rule",
  });
  for (const url of ["/go/abc", "/go/999", "/go/2", "/go/7"]) {
    push({ url, status: 404, proof: "rule" });
  }
  push({ url: "/go/5", status: 410, proof: "rule" });

  /* ── H. Machine files + the uptime hook (status-only rows) ── */

  for (const url of [
    "/robots.txt",
    "/sitemap.xml",
    "/sitemap-varieties-listed.xml",
    "/sitemap-varieties-zero-seller.xml",
    "/sitemap-sellers.xml",
    "/sitemap-crops.xml",
    "/sitemap-series.xml",
    "/sitemap-states.xml",
    "/sitemap-hubs.xml",
    "/llms.txt",
  ]) {
    push({ url, status: 200, proof: "live" });
  }
  push({ url: "/healthz", status: 200, proof: "delta", delta: "Slice 8 uptime hook (new surface, no live equivalent)" });

  return rows;
}


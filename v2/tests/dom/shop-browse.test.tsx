// @vitest-environment jsdom
/**
 * Seller-as-shop — the shop catalog block (components/seller/ShopBrowse.tsx): the
 * server-rendered floor (no-JS: chips/sort/removers/Clear All as links, the GET search
 * form, every state correct from the URL alone), the hydrated in-place layer (local
 * computation from the shipped full set — no fetch — one history entry per deliberate
 * change, replace-while-typing with push on submit/blur/clear, in-place Back/Forward,
 * the §9.5 failure backstop), the applied row + Clear All scope (sort never cleared),
 * focus landings (Clear All while the row persists, else the shop H2 — Ada Ruling 7),
 * thresholds, and the designed states. Expected strings pin the ruled copy while every
 * total and count derives from the test's own listings through the shared model.
 *
 * Non-vacuity (T-A): fails on pre-build code — ShopBrowse and the shop model do not
 * exist there.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children),
}));

import { ShopBrowse, type ShopBrowseInitial } from "@/components/seller/ShopBrowse";
import { PAGE_SIZE } from "@/lib/config";
import { SHOP_SORT_OPTIONS, readShopBrowseFilters, shopCountsFor, shopCropsFor, shopViewListings, type ShopCrop } from "@/lib/shop-browse";
import type { Availability, PublicListing } from "@/lib/validators";

const BASE = "/seller/test-farm";
const NAME = "Test Farm";

const CROPS: ShopCrop[] = [
  { slug: "zinnia", commonName: "Zinnia" },
  { slug: "sweet-pea", commonName: "Sweet Pea" },
  { slug: "cosmos", commonName: "Cosmos" },
];

let nextId = 1;
function listing(over: {
  varietyName?: string;
  crop?: string;
  lifeCycle?: string | null;
  season_class?: "cool_season_hardy_annual" | "warm_season_tender_annual" | null;
  sowing_methods?: ("direct_sow" | "transplant")[];
  colorFamily?: string;
  availability?: Availability;
  lastCheckedAt?: string | null;
}): PublicListing {
  const id = nextId++;
  const crop = over.crop ?? "zinnia";
  return {
    id,
    variety: {
      slug: `v-${id}`,
      varietyName: over.varietyName ?? `Variety ${id}`,
      plant: {
        slug: crop,
        commonName: CROPS.find((c) => c.slug === crop)?.commonName ?? crop,
        latinName: null,
        lifeCycle: over.lifeCycle ?? null,
        season_class: over.season_class ?? null,
        season_source_label: null,
        sowing_methods: over.sowing_methods ?? [],
        sowing_method_source_label: null,
      },
      colorSwatch: null,
      colorFamily: over.colorFamily ?? "pink",
      media: [],
      cropMedia: [],
    },
    seller: { slug: "test-farm", name: NAME, location: null, region: "OR", country: "US", isSmallFarm: false },
    availability: over.availability ?? "in_stock",
    lastCheckedAt: over.lastCheckedAt === undefined ? "2026-11-15" : over.lastCheckedAt,
    firstSeenAt: "2026-11-01",
    goUrl: `https://seeds.hues.flowers/go/${id}`,
    productUrl: null,
    notes: null,
    status: "published",
    packetSizes: [],
    provenance: { source_url: null, retrieved_at: "2026-11-15", method: "human", confidence: 1 },
    sourceLabel: "Shop check",
  };
}

/** A 30-listing shop spanning 3 crops, both seasons, both methods, 3 life cycles, 3 hues. */
function bigShop(): PublicListing[] {
  const out: PublicListing[] = [];
  const crops: [string, "cool_season_hardy_annual" | "warm_season_tender_annual"][] = [
    ["zinnia", "warm_season_tender_annual"],
    ["sweet-pea", "cool_season_hardy_annual"],
    ["cosmos", "warm_season_tender_annual"],
  ];
  const hues = ["pink", "blue", "yellow"];
  const cycles = ["Annual", "Biennial", "Perennial"];
  for (let i = 0; i < 30; i++) {
    const [crop, season] = crops[i % 3]!;
    out.push(
      listing({
        varietyName: `Variety ${String(i).padStart(2, "0")}`,
        crop,
        season_class: season,
        sowing_methods: i % 2 ? ["transplant"] : ["direct_sow"],
        lifeCycle: cycles[i % 3]!,
        colorFamily: hues[i % 3]!,
        availability: i % 10 === 9 ? "sold_out" : "in_stock",
      }),
    );
  }
  return out;
}

/** The server-consistent snapshot for a full set + URL state + page (what the page computes). */
function makeInitial(
  full: PublicListing[],
  sp: Record<string, string | string[] | undefined> = {},
  page = 1,
): { initial: ShopBrowseInitial; full: PublicListing[] } {
  const state = readShopBrowseFilters(sp, CROPS);
  const view = shopViewListings(full, state);
  return {
    full,
    initial: {
      state,
      counts: shopCountsFor(full, state, shopCropsFor(full)),
      items: view.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: view.length,
      page,
    },
  };
}

function renderShop(args: { initial: ShopBrowseInitial; full: PublicListing[]; name?: string }) {
  return render(
    createElement(ShopBrowse, {
      basePath: BASE,
      sellerName: args.name ?? NAME,
      baseTitle: `${args.name ?? NAME} — Flower Seed Seller`,
      initial: args.initial,
      full: args.full,
      crops: CROPS,
    }),
  );
}

const floor = (args: { initial: ShopBrowseInitial; full: PublicListing[]; name?: string }) =>
  renderToStaticMarkup(
    createElement(ShopBrowse, {
      basePath: BASE,
      sellerName: args.name ?? NAME,
      baseTitle: `${args.name ?? NAME} — Flower Seed Seller`,
      initial: args.initial,
      full: args.full,
      crops: CROPS,
    }),
  );

/** Strict narrowing: throw when a query misses instead of casting a nullable away. */
function need<T>(el: T | null | undefined, what: string): T {
  if (el === null || el === undefined) throw new Error(`shop-browse test: missing ${what}`);
  return el;
}

function countLine(): HTMLElement {
  return need(document.getElementById("seller-results-count"), "count line");
}

function resultsRegion(): HTMLElement {
  return need(document.getElementById("shop-results"), "results region");
}

function chip(group: string, name: string): HTMLButtonElement {
  return within(screen.getByRole("group", { name: group })).getByRole("button", { name }) as HTMLButtonElement;
}

function searchField(): HTMLInputElement {
  return screen.getByLabelText(`Search ${NAME}’s shop`) as HTMLInputElement;
}

function pushSpyOn(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(window.history, "pushState");
}

function replaceSpyOn(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(window.history, "replaceState");
}

function sortChip(name: string): HTMLButtonElement {
  // The hydrated Sort control nests a same-named fieldset in its group, so the label
  // query is ambiguous — the chip's data-sort value is the stable handle.
  const value = SHOP_SORT_OPTIONS.find((o) => o.label === name)?.value;
  if (!value) throw new Error(`shop-browse test: unknown sort ${name}`);
  return need(document.querySelector(`button[data-sort="${value}"]`), `sort chip ${name}`) as HTMLButtonElement;
}

/** Local computation never fetches: the stub throws, and this pins zero calls. */
const fetchCalls = () => vi.mocked(fetch).mock.calls;

/** Run the search debounce (~300 ms) and flush the commit's microtasks (fake timers). */
async function settle(ms = 350): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {});
}

/** Local commits settle synchronously, so Ruling 7 handoffs land inside the same act. */
function shopHeading(): HTMLElement {
  return need(document.getElementById("seller-varieties"), "shop H2");
}

beforeEach(() => {
  window.history.replaceState({}, "", BASE);
  // Local computation never fetches: prove it — any fetch attempt fails the test.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("shop-browse test: unexpected fetch (the shop computes locally)");
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("server floor (no-JS: links, the GET form, every state correct from its URL)", () => {
  it("heads the section with the possessive shop H2 (focusable landing, global ring under :focus)", () => {
    const h = floor(makeInitial(bigShop()));
    expect(h).toContain('<h2 id="seller-varieties" tabindex="-1"');
    expect(h).toContain("Test Farm’s shop</h2>");
    expect(h).toContain("focus:outline-3 focus:outline-focus focus:outline-offset-2");
    const seedlings = makeInitial(bigShop());
    expect(floor({ ...seedlings, name: "Peace Seedlings" })).toContain("Peace Seedlings’ shop</h2>");
  });

  it("renders chips as links with aria-current and listings counts — no pressed buttons", () => {
    const full = bigShop();
    const h = floor(makeInitial(full, { season: "cool" }));
    expect(h).toContain('aria-current="true"');
    expect(h).not.toContain("aria-pressed");
    // The only button on the floor is the search submit; every chip is a link.
    expect(h.match(/<button/g) ?? []).toHaveLength(1);
    expect(h).toContain('type="submit"');
    // Counts: the visible numeral + the screen-reader unit "listings" (CS-18).
    expect(h).toContain('<span aria-hidden="true">(10)</span><span class="sr-only">10 listings</span>');
    // Crop chips are plain text (no swatch dot); Hue chips carry dots.
    // Params serialize in group order (crop first — the unit-pinned shopBrowseHref order).
    expect(h).toContain('href="/seller/test-farm?crop=cosmos&amp;season=cool"');
    expect(h).not.toMatch(/crop=cosmos[^>]*SwatchDot/);
    // A held group narrows the counts: with season=cool held, warm reads its own
    // replacement slice (20 — an option holds other groups, never its own) and stays a link.
    expect(h).toContain('href="/seller/test-farm?season=warm"');
  });

  it("renders the search GET form with its bound label, placeholder, submit, and carried params", () => {
    const h = floor(makeInitial(bigShop(), { season: "cool", sort: "name" }));
    expect(h).toContain('<form role="search" action="/seller/test-farm" method="get"');
    expect(h).toContain('<label for="shop-search" class="eyebrow mb-1 block">Search Test Farm’s shop</label>');
    expect(h).toContain('placeholder="Variety or flower name…"');
    expect(h).toContain('type="search"');
    expect(h).toContain('name="q"');
    expect(h).toContain(">Search</button>");
    // The active filters/sort ride hidden inputs (page dropped) — submit searches within them.
    expect(h).toContain('type="hidden" name="season" value="cool"');
    expect(h).toContain('type="hidden" name="sort" value="name"');
    expect(h).not.toContain('type="hidden" name="page"');
    expect(h).not.toContain("combobox");
    expect(h).not.toContain("listbox");
  });

  it("renders sort links (absent while a query is active) and the applied row as links", () => {
    const h = floor(makeInitial(bigShop(), { season: "cool", color_family: "pink,blue", q: "zz" }));
    // No Sort group while q is active; the applied row carries the search remover.
    expect(h).not.toContain(">Sort</legend>");
    expect(h).toContain("Search: “zz”");
    expect(h).toContain('aria-label="Clear the search for zz"');
    expect(h).toContain(">Clear search and filters</a>");
    // Removers keep their siblings: the pink remover holds blue + season + query.
    expect(h).toContain("season=cool");
    expect(h).toContain("color_family=blue");
    expect(h).toContain("q=zz");
  });

  it("count line: the persistent live region with the true ordering phrase", () => {
    const full = bigShop();
    const rest = floor(makeInitial(full));
    expect(rest).toContain('<p id="seller-results-count" class="mt-3 text-muted tabular-nums" aria-live="polite" aria-atomic="true">');
    expect(rest).toContain("30 listings, in stock first. · page 1 of 2");
    expect(floor(makeInitial(full, { sort: "recent" }))).toContain("30 listings, most recently checked first. · page 1 of 2");
    expect(floor(makeInitial(full, { q: "variety" }))).toContain("matches for “variety”, best match first.");
    expect(floor(makeInitial(full, {}, 2))).toContain("30 listings, in stock first. · page 2 of 2");
  });

  it("zero-combination, no-matches (+ scope line + did-you-mean), empty shop, all-sold-out", () => {
    const full = bigShop();
    const zero = floor(makeInitial(full, { crop: "zinnia", color_family: "blue" }));
    expect(zero).toContain("No listings in Test Farm’s shop match those filters.");
    expect(zero).toContain("0 listings, in stock first.");
    expect(zero).toContain("Applied filters"); // the row stays, Clear All recovers
    const miss = floor(makeInitial(full, { q: "alsion", season: "cool" }));
    expect(miss).toContain("No matches for “alsion” in Test Farm’s shop.");
    expect(miss).toContain("With the current filters applied.");
    expect(floor(makeInitial(full, { q: "alsion" }))).not.toContain("With the current filters applied.");
    const dym = floor(makeInitial([listing({ varietyName: "Alison" }), ...full.slice(0, 9)], { q: "alsion" }));
    expect(dym).toContain("Did you mean ");
    expect(dym).toContain(">Alison</a>");
    const empty = floor(makeInitial([]));
    expect(empty).toContain("0 listings</p>");
    expect(empty).toContain("No listings for this seller yet.");
    expect(empty).toContain(">Browse all varieties</a>");
    const soldOut = floor(makeInitial([listing({ availability: "sold_out" }), listing({ availability: "shop_closed" })]));
    expect(soldOut).toContain("Test Farm has nothing in stock right now — listings are shown with their last checked dates.");
  });

  it("results are the shop grid (standard variant, shop cards) with carried pagination", () => {
    const h = floor(makeInitial(bigShop()));
    expect(h).toContain("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4");
    expect(h).toContain("<h3");
    expect(h).toContain("Visit shop →");
    expect(h).not.toContain("listing-stem-rule");
    expect(h).toContain("page=2");
    // Pagination carries the active state (page dropped from chips, kept here).
    const filtered = floor(makeInitial(bigShop(), { season: "cool" }));
    expect(filtered).toContain("season=cool");
    expect(filtered).not.toContain("page=2"); // 10 narrowed results fit one page
  });

  it("thresholds: T=8 no tools; T=9 filters + sort, no search; T=25 all three", () => {
    const eight = floor(makeInitial(bigShop().slice(0, 8)));
    expect(eight).not.toContain("Filters</");
    expect(eight).not.toContain(">Sort</legend>");
    expect(eight).not.toContain('role="search"');
    expect(eight).toContain("8 listings, in stock first."); // the resting order + phrase at every band
    const nine = floor(makeInitial(bigShop().slice(0, 9)));
    expect(nine).toContain(">Crop</legend>");
    expect(nine).toContain(">Sort</legend>");
    expect(nine).not.toContain('role="search"');
    const full = floor(makeInitial(bigShop().slice(0, 25)));
    expect(full).toContain('role="search"');
    expect(full).toContain(">Crop</legend>");
  });

  it("discrimination: a single-crop shop shows no Crop strip while other groups render", () => {
    const single = Array.from({ length: 10 }, (_, i) =>
      listing({ varietyName: `Z ${i}`, crop: "zinnia", season_class: i % 2 ? "cool_season_hardy_annual" : "warm_season_tender_annual" }),
    );
    const h = floor(makeInitial(single));
    expect(h).not.toContain(">Crop</legend>");
    expect(h).toContain(">Season</legend>");
  });
});

describe("hydrated filter tap (in place, local, one entry)", () => {
  it("season tap narrows in place: no fetch, pressed state, rows swap, one entry, focus stays, title synced", () => {
    const full = bigShop();
    const push = pushSpyOn();
    const replace = replaceSpyOn();
    renderShop(makeInitial(full));
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    const line = countLine();
    const cool = chip("Season", "Cool Season Hardy Annuals 10 listings");
    expect(cool.getAttribute("aria-pressed")).toBe("false");
    // jsdom clicks don't take focus; take it explicitly so the commit must preserve it.
    cool.focus();
    document.title = "a stale title";

    fireEvent.click(cool);
    expect(fetchCalls()).toHaveLength(0);
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    expect(countLine()).toBe(line); // the live region updates — it is never remounted
    expect(resultsRegion().textContent).toContain("Variety 01");
    expect(resultsRegion().textContent).not.toContain("Variety 00");
    expect(chip("Season", "Cool Season Hardy Annuals 10 listings").getAttribute("aria-pressed")).toBe("true");
    // Counts recompute with the group held: warm reads its replacement slice and stays operable.
    const warm = chip("Season", "Warm Season Tender Annuals 20 listings");
    expect(warm.getAttribute("aria-pressed")).toBe("false");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm?season=cool");
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?season=cool");
    expect(document.activeElement).toBe(cool);
    expect(document.title).toBe("Test Farm — Flower Seed Seller | seeds.hues.flowers");
    // The applied row appears with the remover + Clear All.
    expect(screen.getByRole("button", { name: "Remove the Season filter, Cool Season Hardy Annuals" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeTruthy();
  });

  it("tapping the active option is a no-op (no entry, no change)", () => {
    window.history.replaceState({}, "", `${BASE}?season=cool`);
    const push = pushSpyOn();
    const replace = replaceSpyOn();
    renderShop(makeInitial(bigShop(), { season: "cool" }));
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    fireEvent.click(chip("Season", "Cool Season Hardy Annuals 10 listings"));
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(fetchCalls()).toHaveLength(0);
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    expect(window.location.search).toBe("?season=cool");
  });

  it("Back/Forward re-sync in place (no entry)", () => {
    const full = bigShop();
    const push = pushSpyOn();
    renderShop(makeInitial(full));
    fireEvent.click(chip("Season", "Cool Season Hardy Annuals 10 listings"));
    expect(window.location.search).toBe("?season=cool");
    expect(countLine().textContent).toBe("10 listings, in stock first.");

    window.history.replaceState({}, "", BASE);
    fireEvent(window, new window.PopStateEvent("popstate"));
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(resultsRegion().textContent).toContain("Variety 00");
    expect(push).toHaveBeenCalledTimes(1);

    window.history.replaceState({}, "", `${BASE}?season=cool`);
    fireEvent(window, new window.PopStateEvent("popstate"));
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    expect(resultsRegion().textContent).not.toContain("Variety 00");
    expect(resultsRegion().textContent).toContain("Variety 01");
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("hydrated hue multi-select (OR within, AND across)", () => {
  it("toggles families: counts follow the toggle definition, one entry per toggle", () => {
    const full = bigShop();
    const push = pushSpyOn();
    renderShop(makeInitial(full));
    fireEvent.click(chip("Hue", "Pink 10 listings"));
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm?color_family=pink");
    // Pink's own count toggles OFF (all 30); Blue toggles ON (pink+blue → 20).
    expect(chip("Hue", "Pink 30 listings").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Hue", "Blue 20 listings").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip("Hue", "Blue 20 listings"));
    expect(countLine().textContent).toBe("20 listings, in stock first.");
    expect(push.mock.calls[1]?.[2]).toBe("/seller/test-farm?color_family=pink%2Cblue");
    expect(push).toHaveBeenCalledTimes(2);
    // Toggling Pink off leaves Blue alone.
    fireEvent.click(chip("Hue", "Pink 10 listings"));
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    expect(push.mock.calls[2]?.[2]).toBe("/seller/test-farm?color_family=blue");
    expect(push).toHaveBeenCalledTimes(3);
    expect(fetchCalls()).toHaveLength(0);
  });

  it("ANDs across groups into the zero-combination state; Clear All recovers in place", () => {
    const full = bigShop();
    const push = pushSpyOn();
    renderShop(makeInitial(full));
    fireEvent.click(chip("Season", "Cool Season Hardy Annuals 10 listings"));
    // Cool-held pinks: 0 — and the 0 stays operable.
    fireEvent.click(chip("Hue", "Pink 0 listings"));
    expect(countLine().textContent).toBe("0 listings, in stock first.");
    expect(resultsRegion().textContent).toContain("No listings in Test Farm’s shop match those filters.");
    // The applied row stays with both removers.
    expect(screen.getByRole("button", { name: "Remove the Season filter, Cool Season Hardy Annuals" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove the Hue filter, Pink" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(resultsRegion().textContent).toContain("Variety 00");
    expect(push).toHaveBeenCalledTimes(3);
    expect(push.mock.calls[2]?.[2]).toBe("/seller/test-farm");
    // The row is gone: focus lands on the shop H2.
    expect(document.activeElement).toBe(shopHeading());
  });
});

describe("hydrated applied row (removers + Clear All scope, Ada Ruling 7)", () => {
  it("a remover that leaves the row hands focus to Clear All", () => {
    renderShop(makeInitial(bigShop(), { season: "cool", color_family: "pink,blue" }));
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    fireEvent.click(screen.getByRole("button", { name: "Remove the Hue filter, Pink" }));
    expect(countLine().textContent).toBe("10 listings, in stock first.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Clear all filters" }));
    // Pink's remover is gone; Blue's and Season's survive.
    expect(screen.queryByRole("button", { name: "Remove the Hue filter, Pink" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove the Hue filter, Blue" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove the Season filter, Cool Season Hardy Annuals" })).toBeTruthy();
  });

  it("a remover that empties the row hands focus to the shop H2", () => {
    const push = pushSpyOn();
    renderShop(makeInitial(bigShop(), { season: "cool" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove the Season filter, Cool Season Hardy Annuals" }));
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm");
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
    expect(document.activeElement).toBe(shopHeading());
  });

  it("Clear All clears filters AND query — never sort", () => {
    const push = pushSpyOn();
    renderShop(makeInitial(bigShop(), { season: "cool", q: "cosmos", sort: "recent" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(countLine().textContent).toBe("30 listings, most recently checked first. · page 1 of 2");
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm?sort=recent");
    // The sort group returns with its prior selection intact; the field re-syncs empty.
    expect(sortChip("Recently checked").getAttribute("aria-pressed")).toBe("true");
    expect(searchField().value).toBe("");
    expect(document.activeElement).toBe(shopHeading());
  });
});

describe("hydrated sort (in place, page reset, phrase follows)", () => {
  it("sort tap commits in place from page 2: rows swap, page resets, one entry", () => {
    const full = bigShop();
    const push = pushSpyOn();
    window.history.replaceState({}, "", `${BASE}?page=2`);
    renderShop(makeInitial(full, {}, 2));
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 2 of 2");
    expect(resultsRegion().textContent).toContain("Variety 26");
    fireEvent.click(sortChip("Name A–Z"));
    expect(countLine().textContent).toBe("30 listings, A–Z. · page 1 of 2");
    expect(resultsRegion().textContent).toContain("Variety 00");
    expect(sortChip("Name A–Z").getAttribute("aria-pressed")).toBe("true");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm?sort=name");
    expect(window.location.search).toBe("?sort=name");
    expect(fetchCalls()).toHaveLength(0);
  });
});

describe("hydrated search (replace while typing, push on the deliberate act)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("typing narrows in place from 2 characters: replace, no push, focus stays, sort group leaves", async () => {
    const full = bigShop();
    const push = pushSpyOn();
    const replace = replaceSpyOn();
    renderShop(makeInitial(full));
    const field = searchField();
    field.focus();
    fireEvent.change(field, { target: { value: "cosmos" } });
    // Before the debounce settles: nothing committed, no entry.
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    await settle();
    expect(countLine().textContent).toBe("10 matches for “cosmos”, best match first.");
    expect(resultsRegion().textContent).toContain("Variety 02");
    expect(resultsRegion().textContent).not.toContain("Variety 00");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[2]).toBe("/seller/test-farm?q=cosmos");
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?q=cosmos");
    expect(document.activeElement).toBe(field);
    expect(fetchCalls()).toHaveLength(0);
    // The sort group is absent while the query is active; the row carries the search remover.
    expect(screen.queryByRole("group", { name: "Sort" })).toBeNull();
    expect(screen.getByRole("button", { name: "Clear the search for cosmos" })).toBeTruthy();
  });

  it("a single character is inert: no narrowing, no entry", async () => {
    const push = pushSpyOn();
    const replace = replaceSpyOn();
    renderShop(makeInitial(bigShop()));
    fireEvent.change(searchField(), { target: { value: "c" } });
    await settle();
    expect(searchField().value).toBe("c");
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(screen.queryByRole("group", { name: "Applied filters" })).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("submit pushes the one entry for the settled query", async () => {
    const push = pushSpyOn();
    const replace = replaceSpyOn();
    renderShop(makeInitial(bigShop()));
    fireEvent.change(searchField(), { target: { value: "cosmos" } });
    await settle();
    expect(window.location.search).toBe("?q=cosmos");
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await act(async () => {});
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm?q=cosmos");
    expect(replace).toHaveBeenCalledTimes(1); // the earlier settle only
    expect(countLine().textContent).toBe("10 matches for “cosmos”, best match first.");
  });

  it("blur with a changed query pushes once (no per-keystroke trail)", async () => {
    const push = pushSpyOn();
    const replace = replaceSpyOn();
    renderShop(makeInitial(bigShop()));
    // Type without letting the debounce settle, then blur: the deliberate act commits.
    fireEvent.change(searchField(), { target: { value: "cosmos" } });
    fireEvent.blur(searchField());
    await act(async () => {});
    await settle();
    expect(countLine().textContent).toBe("10 matches for “cosmos”, best match first.");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[2]).toBe("/seller/test-farm?q=cosmos");
    expect(replace).not.toHaveBeenCalled();
  });

  it("Back from a searched shop returns to the pre-search view in one step", async () => {
    const push = pushSpyOn();
    renderShop(makeInitial(bigShop()));
    fireEvent.change(searchField(), { target: { value: "cosmos" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await act(async () => {});
    expect(push).toHaveBeenCalledTimes(1);
    expect(countLine().textContent).toBe("10 matches for “cosmos”, best match first.");
    // Back over the single search entry: the pre-search view, field re-synced, sort back.
    window.history.replaceState({}, "", BASE);
    fireEvent(window, new window.PopStateEvent("popstate"));
    await act(async () => {});
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(searchField().value).toBe("");
    expect(sortChip("In stock first").getAttribute("aria-pressed")).toBe("true");
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("clearing via the search remover pushes its one entry and lands focus on the H2", async () => {
    const push = pushSpyOn();
    renderShop(makeInitial(bigShop()));
    fireEvent.change(searchField(), { target: { value: "cosmos" } });
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await act(async () => {});
    expect(push).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Clear the search for cosmos" }));
    expect(countLine().textContent).toBe("30 listings, in stock first. · page 1 of 2");
    expect(searchField().value).toBe("");
    expect(push).toHaveBeenCalledTimes(2);
    expect(push.mock.calls[1]?.[2]).toBe("/seller/test-farm");
    expect(document.activeElement).toBe(shopHeading());
  });
});

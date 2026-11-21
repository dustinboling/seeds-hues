/**
 * Slice B (sellers) without a database: status words, list params, ships-to parsing,
 * status wording, the friendly note timestamp, and the rendered D1/D2/D3/D4/D5
 * components (role rendering, Act = absent, eyebrow copy, consequence lines).
 * Children ride as trailing createElement arguments, never as props.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatAdminDateTime } from "@/lib/admin-auth";
import {
  classificationStatusLine,
  editStatusLine,
  formatShipsTo,
  isPubliclyListed,
  parseBadgeFilter,
  parseListingStateFilter,
  parseSellerListParams,
  parseSellerSort,
  platformLabel,
  roleLabel,
  SELLER_FIELD_LABELS,
  sellerStatusLine,
  shipsToWords,
  statusWordFor,
  parseShipsTo,
} from "@/lib/admin/sellers";
import { sellerHref } from "@/app/admin/(protected)/sellers/_components/urls";
import { SellerList, type SellerListParams, type SellerListRow } from "@/app/admin/(protected)/sellers/_components/seller-list";
import { SellerDetail, type SellerDetailData } from "@/app/admin/(protected)/sellers/_components/seller-detail";
import {
  ClassifyForm,
  deactivateConsequence,
  EditSellerForm,
  NoteComposerForm,
  removeConsequence,
  type SellerCtx,
} from "@/app/admin/(protected)/sellers/_components/seller-sheets";

const CTX: SellerCtx = { seller: "songbird-seed-co", q: null, badge: "all", state: "all", sort: "name" };
const PARAMS: SellerListParams = { q: null, badge: "all", state: "all", sort: "name" };
const TYPE_OPTIONS = [
  { value: "wholesale", label: "Wholesale farm seed" },
  { value: "retail", label: "Retail seed shop" },
  { value: "specialty", label: "Specialty grower" },
];
const PLATFORM_OPTIONS = [
  { value: "shopify", label: "Shopify" },
  { value: "woocommerce", label: "WooCommerce" },
  { value: "squarespace", label: "Squarespace" },
  { value: "other", label: "Other" },
];

const LISTED: SellerListRow = {
  slug: "songbird-seed-co",
  name: "Songbird Seed Co.",
  location: "Skagit Valley, WA",
  status: "active",
  eligibility: "approved",
  listingPolicy: "full",
  deletedAt: null,
  isSmallFarm: true,
  liveListings: 3,
};
const CANDIDATE: SellerListRow = { ...LISTED, slug: "hidden-farm", name: "Hidden Farm", eligibility: "candidate", isSmallFarm: false, liveListings: 0, location: null };
const INACTIVE: SellerListRow = { ...LISTED, slug: "sleepy-farm", name: "Sleepy Farm", status: "inactive", isSmallFarm: false };

const DETAIL: SellerDetailData = {
  slug: "songbird-seed-co",
  name: "Songbird Seed Co.",
  type: "specialty",
  platform: "squarespace",
  homepage: "https://www.songbirdseeds.com",
  contactEmail: "hello@songbirdseeds.com",
  location: "Skagit Valley, WA",
  region: "WA",
  country: "US",
  shipsTo: '["US"]',
  description: "Sweet peas.",
  orderingNotes: "Farm-grown packets.",
  status: "active",
  eligibility: "approved",
  listingPolicy: "full",
  deletedAt: null,
  isSmallFarm: true,
  liveListingCount: 2,
  listings: [
    { id: 11, titleRaw: "Songbird Sweet Pea Mix", status: "active", varietyName: "Dearest Sunset", varietySlug: "zinnia-dearest-sunset" },
    { id: 12, titleRaw: null, status: "published", varietyName: "Blue Fire", varietySlug: "zinnia-blue-fire" },
  ],
  notes: [
    { id: 2, authorName: "Ann Admin", authorRole: "admin", body: "Second note.", createdAt: "2026-11-20T14:14:00.000Z" },
    { id: 1, authorName: "Rae Reviewer", authorRole: "reviewer", body: "First note.", createdAt: "2026-11-19T09:00:00.000Z" },
  ],
};

describe("status words (resolution 3)", () => {
  it("Candidate < Active < Not active, from eligibility + public listing state", () => {
    expect(statusWordFor(CANDIDATE)).toBe("Candidate");
    expect(statusWordFor(LISTED)).toBe("Active");
    expect(statusWordFor(INACTIVE)).toBe("Not active");
    expect(statusWordFor({ ...LISTED, eligibility: "rejected" })).toBe("Not active");
    expect(statusWordFor({ ...LISTED, eligibility: "removed_by_request" })).toBe("Not active");
    expect(statusWordFor({ ...LISTED, listingPolicy: "removed" })).toBe("Not active");
    expect(statusWordFor({ ...LISTED, deletedAt: "2026-11-20T00:00:00.000Z" })).toBe("Not active");
    // Eligibility candidate always reads Candidate, even with an active status.
    expect(statusWordFor({ ...CANDIDATE, status: "active" })).toBe("Candidate");
  });

  it("isPubliclyListed is the exact public predicate (approved + active + kept + live)", () => {
    expect(isPubliclyListed(LISTED)).toBe(true);
    for (const s of [CANDIDATE, INACTIVE, { ...LISTED, listingPolicy: "removed" }, { ...LISTED, deletedAt: "2026-11-20T00:00:00.000Z" }, { ...LISTED, eligibility: "rejected" }]) {
      expect(isPubliclyListed(s)).toBe(false);
    }
  });
});

describe("list params and links", () => {
  it("parses the chip and sort params, defaulting garbage to all/name", () => {
    expect(parseBadgeFilter("small")).toBe("small");
    expect(parseBadgeFilter("not_small")).toBe("not_small");
    expect(parseBadgeFilter("bogus")).toBe("all");
    expect(parseListingStateFilter("active")).toBe("active");
    expect(parseListingStateFilter("not_active")).toBe("not_active");
    expect(parseListingStateFilter(null)).toBe("all");
    expect(parseSellerSort("listings")).toBe("listings");
    expect(parseSellerSort("updated")).toBe("updated");
    expect(parseSellerSort("price")).toBe("name");
    expect(parseSellerListParams({ q: "  geo ", badge: "small", state: "nope", sort: "updated" })).toEqual({ q: "geo", badge: "small", state: "all", sort: "updated" });
    expect(parseSellerListParams({ q: "   " })).toEqual({ q: null, badge: "all", state: "all", sort: "name" });
  });

  it("builds stable deep links carrying the list context", () => {
    expect(sellerHref({})).toBe("/admin/sellers");
    expect(sellerHref({ seller: "geoseed" })).toBe("/admin/sellers?seller=geoseed");
    expect(sellerHref({ seller: "geoseed", q: "geo", badge: "small", state: "active", sort: "listings" })).toBe("/admin/sellers?seller=geoseed&q=geo&badge=small&state=active&sort=listings");
    expect(sellerHref({ badge: "all", state: "all", sort: "name" })).toBe("/admin/sellers");
  });
});

describe("ships to (resolution 6)", () => {
  it("parses comma-separated codes, empty → [unknown]", () => {
    expect(parseShipsTo("US, CA")).toEqual(["US", "CA"]);
    expect(parseShipsTo("  us ,ca ")).toEqual(["US", "CA"]);
    expect(parseShipsTo("")).toEqual(["unknown"]);
    expect(parseShipsTo("  , ")).toEqual(["unknown"]);
    expect(parseShipsTo("US, US")).toEqual(["US"]);
  });

  it("formats the stored JSON back to field text and read-only words", () => {
    expect(formatShipsTo('["US","CA"]')).toBe("US, CA");
    expect(formatShipsTo('["unknown"]')).toBe("");
    expect(formatShipsTo("bogus")).toBe("");
    expect(shipsToWords('["US"]')).toBe("US");
    expect(shipsToWords('["unknown"]')).toBe("Unknown");
  });
});

describe("labels", () => {
  it("names platforms and roles in words", () => {
    expect(platformLabel("shopify")).toBe("Shopify");
    expect(platformLabel("woocommerce")).toBe("WooCommerce");
    expect(platformLabel(null)).toBe("Not set");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("reviewer")).toBe("Reviewer");
    expect(SELLER_FIELD_LABELS.location).toBe("Location");
    expect(SELLER_FIELD_LABELS.shipsTo).toBe("Ships to");
  });
});

describe("status wording", () => {
  it("the D3 line names the new value for one field, the fields for several", () => {
    expect(editStatusLine(["location"], { location: "Greenwood, SC" })).toBe("Location updated to Greenwood, SC.");
    expect(editStatusLine(["shipsTo"], { shipsTo: '["US","CA"]' })).toBe("Ships to updated to US, CA.");
    expect(editStatusLine(["description"], { description: null })).toBe("Description updated.");
    expect(editStatusLine(["name", "location"], {})).toBe("Name, Location updated.");
    expect(editStatusLine([], {})).toBe("No changes to save.");
    expect(editStatusLine(["bogus"], {})).toBe("No changes to save.");
    expect(editStatusLine(["description"], { description: "x".repeat(200) })).toBe(`Description updated to ${"x".repeat(120)}….`);
  });

  it("the D4 line states the badge outcome, plus the listing line on completion", () => {
    expect(classificationStatusLine(true, null)).toBe("Classified as a small farm — the badge is showing.");
    expect(classificationStatusLine(false, null)).toBe("Classified as not a small farm — no badge is shown.");
    expect(classificationStatusLine(true, "Hidden Farm")).toBe("Classified as a small farm — the badge is showing. Hidden Farm is now publicly listed.");
  });

  it("generic seller lines resolve from known codes only", () => {
    expect(sellerStatusLine({ status: "note_added" })).toEqual({ kind: "note_added", text: "Note added." });
    expect(sellerStatusLine({ status: "reactivated" })?.text).toMatch(/back on the public site/);
    expect(sellerStatusLine({ status: "removed", name: "Sleepy Farm" })?.text).toBe("Removed Sleepy Farm from the directory.");
    expect(sellerStatusLine({ status: "save_failed" })?.text).toMatch(/Nothing was changed/);
    expect(sellerStatusLine({})).toBeNull();
    expect(sellerStatusLine({ status: "bogus" })).toBeNull();
  });

  it("note timestamps read friendly with time, never ISO", () => {
    // Pacific rendering (Slice C resolution 14): the farm's wall clock, not UTC.
    expect(formatAdminDateTime("2026-11-20T22:14:00.000Z")).toBe("Nov 20, 2026 · 2:14 PM");
    expect(formatAdminDateTime("2026-11-20T14:14:00.000Z")).toBe("Nov 20, 2026 · 6:14 AM");
    expect(formatAdminDateTime("2026-11-20T00:05:00.000Z")).toBe("Nov 19, 2026 · 4:05 PM");
    expect(formatAdminDateTime("2026-11-20T12:00:00.000Z")).toBe("Nov 20, 2026 · 4:00 AM");
    // After 4 PM Pacific, the date stays on the same calendar day (the UTC bug showed tomorrow).
    expect(formatAdminDateTime("2026-11-21T01:30:00.000Z")).toBe("Nov 20, 2026 · 5:30 PM");
    expect(formatAdminDateTime("2026-11-20")).toBe("Nov 20, 2026");
    expect(formatAdminDateTime(null)).toBe("");
    expect(formatAdminDateTime("bogus")).toBe("");
  });
});

describe("D1 list", () => {
  const html = renderToStaticMarkup(createElement(SellerList, { rows: [LISTED, CANDIDATE, INACTIVE], total: 3, params: PARAMS, selected: "songbird-seed-co" }));

  it("renders the count line, rows loudest-first, badge, and status words", () => {
    expect(html).toContain("3 sellers");
    expect(html).toContain("Songbird Seed Co.");
    expect(html).toContain("Skagit Valley, WA");
    expect(html).toContain("Small farm");
    expect(html).toContain("3 listings · Active");
    expect(html).toContain("0 listings · Candidate");
    expect(html).toContain("Not active");
  });

  it("marks the selection and the active chips with aria-current", () => {
    expect(html).toContain('href="/admin/sellers?seller=songbird-seed-co#detail"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Filter by classification");
    expect(html).toContain("Filter by listing state");
    expect(html).toContain("Sort: Name A–Z");
    expect(html).toContain("Most listings");
    expect(html).toContain("Recently updated");
  });

  it("names the seller in the no-results state, with a clear-search escape", () => {
    const empty = renderToStaticMarkup(createElement(SellerList, { rows: [], total: 0, params: { ...PARAMS, q: "zzz" }, selected: null }));
    expect(empty).toContain("No sellers match");
    expect(empty).toContain("zzz");
    expect(empty).toContain("Clear search");
    expect(empty).toContain('<a href="/admin/sellers" class="btn btn-secondary">Clear search</a>');
  });
});

describe("D2 detail", () => {
  const base = { detail: DETAIL, ctx: CTX, backHref: "/admin/sellers", updatedLine: null, classifiedLine: null, genericStatus: null, typeOptions: TYPE_OPTIONS, platformOptions: PLATFORM_OPTIONS };

  it("shows the header, the public facts, and View public page when listed", () => {
    const html = renderToStaticMarkup(createElement(SellerDetail, { ...base, role: "admin" }));
    expect(html).toContain("Songbird Seed Co.");
    expect(html).toContain("Small farm");
    expect(html).toContain("Active");
    expect(html).toContain("View public page");
    expect(html).toContain("/seller/songbird-seed-co");
    expect(html).toContain("https://www.songbirdseeds.com");
    expect(html).toContain("hello@songbirdseeds.com");
    expect(html).toContain("Specialty grower");
    expect(html).toContain("Squarespace");
    expect(html).toContain("See all in Listings");
    expect(html).toContain("/admin/listings?seller=songbird-seed-co");
  });

  it("renders the status word alone for a candidate or inactive seller (no 404 link)", () => {
    for (const d of [{ ...DETAIL, eligibility: "candidate" }, { ...DETAIL, status: "inactive" }]) {
      const html = renderToStaticMarkup(createElement(SellerDetail, { ...base, detail: d, role: "admin" }));
      expect(html).not.toContain("View public page");
      expect(html).toContain(d.eligibility === "candidate" ? "Candidate" : "Not active");
    }
  });

  it("keeps Act absent for Reviewer: no Edit, Change, or danger zone — same layout", () => {
    const admin = renderToStaticMarkup(createElement(SellerDetail, { ...base, role: "admin" }));
    const reviewer = renderToStaticMarkup(createElement(SellerDetail, { ...base, role: "reviewer" }));
    for (const word of ["Edit", "Change", "Danger zone", "Deactivate seller", "Remove seller"]) expect(admin).toContain(word);
    for (const word of [">Edit<", ">Change<", "Danger zone", "Deactivate seller", "Remove seller"]) expect(reviewer).not.toContain(word);
    // View = read-only render: the same facts, the same badge-or-words.
    for (const word of ["Information", "Classification", "Small farm", "Sweet peas.", "Listings", "Add note"]) {
      expect(reviewer).toContain(word);
    }
  });

  it("heads a deactivated seller with the caution banner; Reactivate is Admin-only", () => {
    const d = { ...DETAIL, status: "inactive" };
    const admin = renderToStaticMarkup(createElement(SellerDetail, { ...base, detail: d, role: "admin" }));
    const reviewer = renderToStaticMarkup(createElement(SellerDetail, { ...base, detail: d, role: "reviewer" }));
    for (const h of [admin, reviewer]) expect(h).toContain("This seller is deactivated — their page and listings are hidden from the public site.");
    expect(admin).toContain("Reactivate");
    expect(reviewer).not.toContain("Reactivate");
    expect(renderToStaticMarkup(createElement(SellerDetail, { ...base, role: "admin" }))).not.toContain("This seller is deactivated");
  });

  it("announces just-edited lines at the head of their section", () => {
    const html = renderToStaticMarkup(createElement(SellerDetail, { ...base, role: "admin", updatedLine: "Location updated to Greenwood, SC.", classifiedLine: "Classified as a small farm — the badge is showing." }));
    expect(html).toContain("Location updated to Greenwood, SC.");
    expect(html).toContain("Classified as a small farm — the badge is showing.");
    expect(html).toContain('role="status"');
  });
});

describe("D5 notes panel", () => {
  const base = { detail: DETAIL, ctx: CTX, backHref: "/admin/sellers", updatedLine: null, classifiedLine: null, genericStatus: null, typeOptions: TYPE_OPTIONS, platformOptions: PLATFORM_OPTIONS, role: "reviewer" };

  it("makes never-public unmistakable, newest-first, both roles", () => {
    const html = renderToStaticMarkup(createElement(SellerDetail, base));
    expect(html.toLowerCase()).toContain("internal notes — never shown on the public site");
    expect(html).toContain("bg-paper-deep");
    expect(html).toContain("border-line-strong");
    expect(html).toContain("Add note");
    expect(html.indexOf("Second note.")).toBeLessThan(html.indexOf("First note."));
    // Pacific rendering (Slice C resolution 14).
    expect(html).toContain("Ann Admin · Admin · Nov 20, 2026 · 6:14 AM");
    expect(html).toContain("Rae Reviewer · Reviewer · Nov 19, 2026 · 1:00 AM");
  });

  it("states the empty state in words", () => {
    const html = renderToStaticMarkup(createElement(SellerDetail, { ...base, detail: { ...DETAIL, notes: [] } }));
    expect(html).toContain("No notes yet. Notes are only visible inside admin — add anything the team should know about this seller.");
  });
});

describe("D3/D4/composer forms", () => {
  const defaults = {
    slug: "songbird-seed-co",
    name: "Songbird Seed Co.",
    type: "specialty",
    platform: "squarespace",
    homepage: "https://www.songbirdseeds.com",
    contactEmail: "hello@songbirdseeds.com",
    location: "Skagit Valley, WA",
    region: "WA",
    country: "US",
    shipsTo: '["unknown"]',
    description: "Sweet peas.",
    orderingNotes: null,
  };

  it("groups the D3 fields with the read-only web address and the sticky save bar", () => {
    const html = renderToStaticMarkup(createElement(EditSellerForm, { seller: defaults, typeOptions: TYPE_OPTIONS, platformOptions: PLATFORM_OPTIONS, ctx: CTX, onClose: () => {}, onDiscardRequest: () => {} }));
    for (const g of ["Identity", "Contact &amp; links", "Location", "About"]) expect(html).toContain(g);
    expect(html).toContain("/seller/songbird-seed-co");
    expect(html).toContain("The web address doesn&#x27;t change, so links keep working.");
    expect(html).toContain('name="shipsTo"');
    expect(html).toContain("Save changes");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("is_small_farm");
  });

  it("asks the classification in Dustin's framing, pre-selected, with the house line", () => {
    const html = renderToStaticMarkup(createElement(ClassifyForm, { sellerName: "Songbird", isSmallFarm: true, isCandidate: false, ctx: CTX }));
    expect(html).toContain("Is Songbird a small farm, or a larger operation?");
    expect(html).toContain("Shows the Small farm badge on their page and listings, and includes them in the Small farms filter.");
    expect(html).toContain("No badge is shown. They&#x27;re listed like any other seller.");
    expect(html).toContain("This is a judgment call — there&#x27;s no size test. When in doubt, leave the badge off.");
    expect(html).toContain("Why");
    expect(html).toContain("kept with the internal notes");
    expect(html).toContain("Save classification");
    expect(html).not.toContain("lists Songbird publicly");
  });

  it("tells a candidate's classifier the save lists them publicly", () => {
    const html = renderToStaticMarkup(createElement(ClassifyForm, { sellerName: "Hidden Farm", isSmallFarm: false, isCandidate: true, ctx: CTX }));
    expect(html).toContain("Saving the classification lists Hidden Farm publicly — their details are finished.");
  });

  it("keeps the composer to one textarea behind Add note", () => {
    const html = renderToStaticMarkup(createElement(NoteComposerForm, { ctx: CTX }));
    expect(html).toContain('name="body"');
    expect(html).toContain("Add note");
  });
});

describe("danger-zone consequence copy", () => {
  it("names the listing count and the honest reversibility", () => {
    expect(deactivateConsequence(3)).toBe("Their page and 3 listings will come off the public site. Reactivating brings them back.");
    expect(deactivateConsequence(1)).toBe("Their page and 1 listing will come off the public site. Reactivating brings them back.");
    expect(removeConsequence(3)).toBe("Their page and 3 listings will come off the public site. This can be undone by Hue from the record, not from this screen.");
    expect(removeConsequence(0)).toBe("Their page will come off the public site. This can be undone by Hue from the record, not from this screen.");
  });
});

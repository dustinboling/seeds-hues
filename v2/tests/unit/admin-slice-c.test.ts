/**
 * Slice C (listings + varieties + accounts) without a database: status words, list
 * params, event words, retire reasons, alias labels, danger-zone and confirm copy, role
 * copy, status wording, Pacific date rendering, and the rendered E1/E2/F1/F2/F3/G1/G2
 * components (role rendering, Act = absent, RA-1 labels).
 * Children ride as trailing createElement arguments, never as props.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin-auth";
import {
  composeRetireReason,
  isRetireReason,
  listingEventLine,
  listingEventWord,
  listingStatusLine,
  parseListingChip,
  parseListingListParams,
  retireConsequence,
  RETIRE_REASONS,
  statusWordForListing,
} from "@/lib/admin/listings";
import {
  ADD_ALIAS_CONSEQUENCE,
  aliasLabel,
  parseVarietyListParams,
  REMOVE_ALIAS_CONSEQUENCE,
  varietyRemoveBlockLine,
  varietyRemoveConsequence,
  varietyStatusLine,
} from "@/lib/admin/varieties";
import {
  accountStatusLine,
  accountStatusWord,
  currentRoleWords,
  grantAdminConsequence,
  grantFarmOwnerConsequence,
  isAccountRole,
  parseAccountListParams,
  REVOKE_FARM_OWNER_CONSEQUENCE,
  ROLE_CARDS,
  roleHistoryLine,
  roleWord,
  SELF_ROLE_LINE,
  shownName,
} from "@/lib/admin/accounts";
import { listingHref } from "@/app/admin/(protected)/listings/_components/urls";
import { ListingList } from "@/app/admin/(protected)/listings/_components/listing-list";
import { ListingDetail, type ListingDetailData } from "@/app/admin/(protected)/listings/_components/listing-detail";
import { RetireForm } from "@/app/admin/(protected)/listings/_components/listing-sheets";
import { varietyHref } from "@/app/admin/(protected)/varieties/_components/urls";
import { VarietyList } from "@/app/admin/(protected)/varieties/_components/variety-list";
import { CropList } from "@/app/admin/(protected)/varieties/_components/crop-list";
import { VarietyDetail, type VarietyDetailData } from "@/app/admin/(protected)/varieties/_components/variety-detail";
import { AddAliasForm } from "@/app/admin/(protected)/varieties/_components/variety-sheets";
import { accountHref } from "@/app/admin/(protected)/accounts/_components/urls";
import { AccountList } from "@/app/admin/(protected)/accounts/_components/account-list";
import { AccountDetail, type AccountDetailData } from "@/app/admin/(protected)/accounts/_components/account-detail";
import { FarmOwnerForm, GrantAdminConfirmView, GrantFarmOwnerConfirmView, RoleForm } from "@/app/admin/(protected)/accounts/_components/account-sheets";

const LISTED_SELLER = { sellerEligibility: "approved", sellerStatus: "active", sellerListingPolicy: "full", sellerDeletedAt: null };
const INACTIVE_SELLER = { sellerEligibility: "approved", sellerStatus: "inactive", sellerListingPolicy: "full", sellerDeletedAt: null };

describe("E1 status words (resolution 5)", () => {
  it("maps removed / sold-out visible / visible / plain statuses", () => {
    expect(statusWordForListing({ status: "removed", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Retired");
    expect(statusWordForListing({ status: "published", availability: "sold_out", deletedAt: null, ...LISTED_SELLER })).toBe("Sold out");
    expect(statusWordForListing({ status: "active", availability: "in_stock", deletedAt: null, ...LISTED_SELLER })).toBe("Active");
    expect(statusWordForListing({ status: "published", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Active");
    expect(statusWordForListing({ status: "gone", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Gone");
    expect(statusWordForListing({ status: "stale", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Stale");
    expect(statusWordForListing({ status: "pending", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Pending");
    expect(statusWordForListing({ status: "unverified", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Unverified");
    expect(statusWordForListing({ status: "inactive", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Inactive");
    expect(statusWordForListing({ status: "rejected", availability: "unknown", deletedAt: null, ...LISTED_SELLER })).toBe("Rejected");
  });

  it("a published listing from a hidden seller is not Active", () => {
    expect(statusWordForListing({ status: "published", availability: "in_stock", deletedAt: null, ...INACTIVE_SELLER })).toBe("Published");
    expect(statusWordForListing({ status: "published", availability: "sold_out", deletedAt: null, ...INACTIVE_SELLER })).toBe("Published");
  });

  it("parses chips, deep-link slugs and the window", () => {
    expect(parseListingChip("sold_out")).toBe("sold_out");
    expect(parseListingChip("bogus")).toBe("all");
    expect(parseListingListParams({})).toEqual({ q: null, chip: "all", seller: null, variety: null, show: 50 });
    expect(parseListingListParams({ q: "  chantilly ", chip: "retired", seller: "GeoSeed", variety: "nope!", show: "70" })).toEqual({
      q: "chantilly",
      chip: "retired",
      seller: "geoseed",
      variety: null,
      show: 100,
    });
  });
});

describe("E2 history + retire (resolutions 4, 7, 8)", () => {
  it("renders all five event kinds in plain words", () => {
    expect(listingEventWord("first_seen")).toBe("Published");
    expect(listingEventWord("restocked")).toBe("Back in stock");
    expect(listingEventWord("sold_out")).toBe("Marked sold out");
    expect(listingEventWord("gone")).toBe("Retired");
    expect(listingEventWord("restored")).toBe("Restored");
  });

  it("appends actor and reason where present", () => {
    expect(listingEventLine({ event: "gone", reason: "Not seed", actor: "Hue" }, "Nov 20, 2026")).toBe("Retired Nov 20, 2026 · by Hue — reason: Not seed");
    expect(listingEventLine({ event: "gone", reason: null, actor: null }, "Nov 20, 2026")).toBe("Retired Nov 20, 2026");
    expect(listingEventLine({ event: "restored", reason: null, actor: "Dustin" }, "Nov 21, 2026")).toBe("Restored Nov 21, 2026 · by Dustin");
    // Reasons belong to gone events only — a stray reason elsewhere never renders.
    expect(listingEventLine({ event: "restocked", reason: "Not seed", actor: null }, "Nov 20, 2026")).toBe("Back in stock Nov 20, 2026");
  });

  it("validates and composes the retire reason", () => {
    expect(RETIRE_REASONS).toEqual(["Wrong variety", "Not seed", "Dead link", "Duplicate listing", "Other"]);
    expect(isRetireReason("Not seed")).toBe(true);
    expect(isRetireReason("junk")).toBe(false);
    expect(composeRetireReason("Not seed", null)).toBe("Not seed");
    expect(composeRetireReason("Other", "  sold as bulbs  ")).toBe("Other — sold as bulbs");
    expect(retireConsequence("Chantilly Purple")).toBe("This listing will come off 'Chantilly Purple's page. The seller's other listings stay.");
  });

  it("writes listing status lines", () => {
    expect(listingStatusLine({ status: "retired", variety: "Chantilly Purple" })?.text).toBe("Retired — it is off 'Chantilly Purple's page.");
    expect(listingStatusLine({ status: "restored", variety: "Chantilly Purple" })?.text).toBe("Restored — it is back on 'Chantilly Purple's page.");
    expect(listingStatusLine({ status: "restore_skipped" })?.text).toMatch(/wasn't retired/);
    expect(listingStatusLine({ status: "save_failed" })?.text).toMatch(/Nothing was changed/);
    expect(listingStatusLine({})).toBeNull();
    expect(listingStatusLine({ status: "bogus" })).toBeNull();
  });
});

describe("F2 aliases + danger zone (resolutions 9, 11)", () => {
  it("labels decision aliases with provenance, everything else as another name", () => {
    expect(aliasLabel({ source: "duplicate_decision", decidedByName: "Rae" }, "Nov 20, 2026")).toBe("Added from a duplicate decision · Nov 20, 2026 · by Rae");
    expect(aliasLabel({ source: "duplicate_decision", decidedByName: null }, null)).toBe("Added from a duplicate decision");
    expect(aliasLabel({ source: null, decidedByName: null }, null)).toBe("another name for this variety");
    expect(ADD_ALIAS_CONSEQUENCE).toBe("This name will find this variety in search.");
    expect(REMOVE_ALIAS_CONSEQUENCE).toBe("This name will stop finding this variety in search, and the scout may propose this variety again under it.");
  });

  it("blocks removal in words naming the count", () => {
    expect(varietyRemoveBlockLine(3)).toBe("This variety has 3 live listings. Retire them before removing the variety.");
    expect(varietyRemoveBlockLine(1)).toBe("This variety has 1 live listing. Retire it before removing the variety.");
    expect(varietyRemoveConsequence("Marshmallow")).toBe(
      "'Marshmallow's public page will come off the site, and the name will stop resolving in search. Its listings, other names, and waitlist entries stay in the record untouched. This can be undone by Hue from the record, not from this screen.",
    );
  });

  it("parses the tab, crop and window", () => {
    expect(parseVarietyListParams({})).toEqual({ tab: "varieties", q: null, crop: null, show: 50 });
    expect(parseVarietyListParams({ tab: "crops", crop: "Sweet-Pea", show: "1" })).toEqual({ tab: "crops", q: null, crop: "sweet-pea", show: 50 });
  });

  it("writes variety status lines", () => {
    expect(varietyStatusLine({ status: "alias_added", name: "Chantilly" })?.text).toBe("'Chantilly' now finds this variety in search.");
    expect(varietyStatusLine({ status: "alias_removed", name: "Chantilly" })?.text).toBe("'Chantilly' no longer finds this variety in search.");
    expect(varietyStatusLine({ status: "variety_removed", name: "Marshmallow" })?.text).toBe("Removed 'Marshmallow' — its page is off the public site.");
    expect(varietyStatusLine({ status: "save_failed" })?.text).toMatch(/Nothing was changed/);
    expect(varietyStatusLine({})).toBeNull();
  });
});

describe("G2 roles + farm owner (resolutions 12, 13)", () => {
  it("shows displayName, else name, else the email", () => {
    expect(shownName({ displayName: "Dee", name: "Dustin", email: "d@example.com" })).toBe("Dee");
    expect(shownName({ displayName: null, name: "Dustin", email: "d@example.com" })).toBe("Dustin");
    expect(shownName({ displayName: " ", name: "", email: "d@example.com" })).toBe("d@example.com");
  });

  it("quotes the spec's three radio cards exactly", () => {
    expect(ROLE_CARDS.map((c) => [c.title, c.words])).toEqual([
      ["Admin", "Everything: edit sellers, classify, remove, manage roles."],
      ["Reviewer", "Review and approve queues, decide duplicates, read and add seller notes. Can't edit sellers or remove anything — except approving a seller correction, which applies the fix right away."],
      ["Visitor", "No admin access. A normal Seed Directory account."],
    ]);
    expect(isAccountRole("admin")).toBe(true);
    expect(isAccountRole("superadmin")).toBe(false);
  });

  it("words roles, history, confirms and status", () => {
    expect(currentRoleWords("visitor")).toBe("Visitor — no admin access");
    expect(currentRoleWords("reviewer")).toBe("Reviewer");
    expect(currentRoleWords("admin")).toBe("Admin");
    expect(roleWord("reviewer")).toBe("Reviewer");
    expect(roleHistoryLine({ toRole: "reviewer", createdAt: "2026-11-20T22:14:00.000Z", actor: "Dustin" }, "Nov 20, 2026 · 2:14 PM", "Nov 1, 2026", "reviewer")).toBe(
      "Reviewer since Nov 20, 2026 · 2:14 PM · set by Dustin",
    );
    expect(roleHistoryLine(null, null, "Nov 1, 2026", "visitor")).toBe("Visitor since Nov 1, 2026");
    expect(grantAdminConsequence("Rae")).toBe("Rae will be able to edit and remove sellers and give other people roles.");
    expect(SELF_ROLE_LINE).toBe("You can't change your own role.");
    expect(REVOKE_FARM_OWNER_CONSEQUENCE).toBe("Revoking keeps the account and its waiting lists.");
    expect(grantFarmOwnerConsequence("Rae", "Songbird")).toBe("Rae will be marked as the owner of Songbird.");
    expect(accountStatusWord("active")).toBe("Active");
    expect(accountStatusWord("banned")).toBe("Banned");
  });

  it("parses account params and writes status lines", () => {
    expect(parseAccountListParams({})).toEqual({ q: null, show: 50 });
    expect(accountStatusLine({ status: "role_changed", name: "Rae", role: "reviewer" })?.text).toBe("Rae is now Reviewer.");
    expect(accountStatusLine({ status: "role_unchanged" })?.text).toBe("No changes to save.");
    expect(accountStatusLine({ status: "farm_granted", name: "Rae", seller: "Songbird" })?.text).toBe("Rae is now the owner of Songbird.");
    expect(accountStatusLine({ status: "farm_revoked" })?.text).toMatch(/waiting lists stay/);
    expect(accountStatusLine({ status: "save_failed" })?.text).toMatch(/Nothing was changed/);
    expect(accountStatusLine({})).toBeNull();
  });
});

describe("workspace links", () => {
  it("builds listing, variety and account hrefs, omitting defaults", () => {
    expect(listingHref({})).toBe("/admin/listings");
    expect(listingHref({ listing: 7, q: "chantilly", chip: "sold_out", seller: "geoseed", show: 100 })).toBe("/admin/listings?listing=7&q=chantilly&chip=sold_out&seller=geoseed&show=100");
    expect(listingHref({ listing: 7, chip: "all", show: 50 })).toBe("/admin/listings?listing=7");
    expect(varietyHref({})).toBe("/admin/varieties");
    expect(varietyHref({ tab: "crops" })).toBe("/admin/varieties?tab=crops");
    expect(varietyHref({ variety: "chantilly", crop: "snapdragon" })).toBe("/admin/varieties?variety=chantilly&crop=snapdragon");
    expect(accountHref({})).toBe("/admin/accounts");
    expect(accountHref({ account: 9, q: "rae" })).toBe("/admin/accounts?account=9&q=rae");
  });
});

describe("Pacific rendering (resolution 14)", () => {
  it("pins the farm's wall clock for the slice's date paths", () => {
    expect(formatAdminDateTime("2026-11-20T22:14:00.000Z")).toBe("Nov 20, 2026 · 2:14 PM");
    expect(formatAdminDateTime("2026-11-21T01:30:00.000Z")).toBe("Nov 20, 2026 · 5:30 PM");
    expect(formatAdminDate("2026-11-20T03:14:00.000Z")).toBe("Nov 19, 2026");
    expect(formatAdminDate("2026-11-21")).toBe("Nov 21, 2026");
    expect(formatAdminDateTime("2026-11-20T22:14:00+02:00")).toBe("Nov 20, 2026 · 12:14 PM");
  });
});

// ─── E1/E2 components ─────────────────────────────────────────────────────────

const E1_ROWS = [
  { id: 7, titleRaw: "Chantilly Purple Snapdragon Seeds", status: "published", availability: "in_stock", lastCheckedAt: "2026-11-20T22:14:00.000Z", deletedAt: null, varietySlug: "v", varietyName: "Chantilly Purple", sellerSlug: "s", sellerName: "Songbird", ...LISTED_SELLER },
  { id: 9, titleRaw: null, status: "gone", availability: "unknown", lastCheckedAt: null, deletedAt: null, varietySlug: "w", varietyName: "Winter Bloom", sellerSlug: "g", sellerName: "GeoSeed", ...LISTED_SELLER },
];

describe("E1 list", () => {
  const html = renderToStaticMarkup(
    createElement(ListingList, {
      rows: E1_ROWS,
      total: 1813,
      params: { q: null, chip: "all", seller: "songbird", variety: null, show: 50 },
      selected: 7,
      deepLinks: { seller: { slug: "songbird", name: "Songbird Seed Co." }, variety: null },
    }),
  );

  it("renders rows loudest-first with variety, seller, status word and checked date", () => {
    expect(html).toContain("Chantilly Purple Snapdragon Seeds");
    expect(html).toContain("Winter Bloom"); // title falls back to the variety name
    expect(html).toContain("Active");
    expect(html).toContain("Gone");
    expect(html).toContain("Checked Nov 20, 2026");
    expect(html).toContain("Not checked yet");
    expect(html).toContain("1,813 listings");
    expect(html).toContain("Showing 2 of 1,813");
    expect(html).toContain("Show more");
  });

  it("marks chips and selection with aria-current and chips the deep link", () => {
    expect(html).toContain("Sold out");
    expect(html).toContain("Retired");
    expect(html).toContain("Seller: Songbird Seed Co.");
    expect(html).toContain('aria-label="Remove the seller filter, Seller: Songbird Seed Co."');
  });

  it("offers Clear search on no results", () => {
    const empty = renderToStaticMarkup(
      createElement(ListingList, { rows: [], total: 0, params: { q: "zzz", chip: "all", seller: null, variety: null, show: 50 }, selected: null, deepLinks: { seller: null, variety: null } }),
    );
    expect(empty).toContain("No listings match");
    expect(empty).toContain("zzz");
    expect(empty).toContain("Clear search");
  });
});

const E2_DETAIL: ListingDetailData = {
  id: 7,
  titleRaw: "Chantilly Purple Snapdragon Seeds",
  productUrl: "https://example.com/p/7",
  status: "published",
  availability: "sold_out",
  deletedAt: null,
  varietySlug: "chantilly-purple",
  varietyName: "Chantilly Purple",
  sellerSlug: "songbird-seed-co",
  sellerName: "Songbird Seed Co.",
  ...LISTED_SELLER,
  packets: [
    { label: "Packet", seedCount: 25 },
    { label: "Bulk", seedCount: null },
  ],
  history: [
    { event: "first_seen", at: "2026-11-19T18:00:00.000Z", reason: null, actor: null },
    { event: "sold_out", at: "2026-11-20T18:00:00.000Z", reason: null, actor: null },
    { event: "restocked", at: "2026-11-20T20:00:00.000Z", reason: null, actor: "Hue" },
    { event: "gone", at: "2026-11-20T22:00:00.000Z", reason: "Not seed — sold as bulbs", actor: "Dustin" },
    { event: "restored", at: "2026-11-21T00:00:00.000Z", reason: null, actor: "Dustin" },
  ],
};
const E2_CTX = { listing: "7", q: null, chip: "all", seller: null, variety: null, show: "50" };

describe("E2 detail", () => {
  const adminHtml = renderToStaticMarkup(createElement(ListingDetail, { detail: E2_DETAIL, role: "admin", ctx: E2_CTX, backHref: "/admin/listings", genericStatus: null }));

  it("renders title, outbound link, cross-links, status, packets and history", () => {
    expect(adminHtml).toContain("Chantilly Purple Snapdragon Seeds");
    expect(adminHtml).toContain('target="_blank"');
    expect(adminHtml).toContain("/admin/sellers?seller=songbird-seed-co");
    expect(adminHtml).toContain("/admin/varieties?variety=chantilly-purple");
    expect(adminHtml).toContain("Sold out");
    expect(adminHtml).toContain("Packet");
    expect(adminHtml).toContain("25 seeds");
    expect(adminHtml).toContain("Bulk");
    expect(adminHtml).not.toContain("$");
    expect(adminHtml).not.toMatch(/price/i);
    for (const word of ["Published", "Marked sold out", "Back in stock", "Retired", "Restored"]) expect(adminHtml).toContain(word);
    expect(adminHtml).toContain("by Hue");
    expect(adminHtml).toContain("by Dustin");
    expect(adminHtml).toContain("reason: Not seed");
  });

  it("offers Retire to admins and nothing to reviewers (Act = absent)", () => {
    expect(adminHtml).toContain("Retire listing");
    const reviewerHtml = renderToStaticMarkup(createElement(ListingDetail, { detail: E2_DETAIL, role: "reviewer", ctx: E2_CTX, backHref: "/admin/listings", genericStatus: null }));
    expect(reviewerHtml).not.toContain("Retire listing");
    expect(reviewerHtml).not.toContain("Restore listing");
    expect(reviewerHtml).toContain("Sold out"); // the read-only render keeps the facts
  });

  it("shows the caution banner + Restore on a retired listing (admin only)", () => {
    const retired = renderToStaticMarkup(
      createElement(ListingDetail, { detail: { ...E2_DETAIL, status: "removed" }, role: "admin", ctx: E2_CTX, backHref: "/admin/listings", genericStatus: null }),
    );
    expect(retired).toContain("This listing is retired");
    expect(retired).toContain("Restore listing");
    expect(retired).not.toContain("Retire listing");
    const reviewerRetired = renderToStaticMarkup(
      createElement(ListingDetail, { detail: { ...E2_DETAIL, status: "removed" }, role: "reviewer", ctx: E2_CTX, backHref: "/admin/listings", genericStatus: null }),
    );
    expect(reviewerRetired).toContain("This listing is retired");
    expect(reviewerRetired).not.toContain("Restore listing");
  });

  it("carries the reason select inside the retire confirm", () => {
    const form = renderToStaticMarkup(createElement(RetireForm, { listingId: 7, varietyName: "Chantilly Purple", ctx: E2_CTX, onClose: () => {} }));
    for (const r of RETIRE_REASONS) expect(form).toContain(r);
    expect(form).toContain('name="note"');
    expect(form).toContain("will come off");
    expect(form).toContain("Retire listing");
    expect(form).toContain("btn-danger");
  });
});

// ─── F1/F2/F3 components ──────────────────────────────────────────────────────

const F1_ROWS = [
  { slug: "chantilly-purple", name: "Chantilly Purple", commonName: "Snapdragon", liveSellers: 3, aliasCount: 2, matchedAlias: null },
  { slug: "xantippe", name: "Xantippe", commonName: "Celosia", liveSellers: 1, aliasCount: 1, matchedAlias: "Yellow Plume" },
];
const CROPS = [
  { slug: "snapdragon", commonName: "Snapdragon" },
  { slug: "celosia", commonName: "Celosia" },
];

describe("F1 list", () => {
  const html = renderToStaticMarkup(
    createElement(VarietyList, { rows: F1_ROWS, total: 2, params: { q: "plume", crop: "celosia", show: 50 }, selected: "xantippe", crops: CROPS }),
  );

  it("renders rows with crop and counts, alias matches labeled", () => {
    expect(html).toContain("Chantilly Purple");
    expect(html).toContain("Snapdragon");
    expect(html).toContain("3 sellers · 2 other names");
    expect(html).toContain("1 seller · 1 other name");
    expect(html).toContain("Matched another name:");
    expect(html).toContain("Yellow Plume");
    expect(html).toContain("2 varieties");
  });

  it("renders the single-select crop strip with aria-current", () => {
    expect(html).toContain("Celosia");
    expect(html).toContain('aria-current="true"');
  });

  it("offers Clear search on no results", () => {
    const empty = renderToStaticMarkup(createElement(VarietyList, { rows: [], total: 0, params: { q: "zzz", crop: null, show: 50 }, selected: null, crops: CROPS }));
    expect(empty).toContain("No varieties match");
    expect(empty).toContain("Clear search");
  });
});

describe("F3 crops", () => {
  it("lists crops with counts linking back to F1", () => {
    const html = renderToStaticMarkup(createElement(CropList, { rows: [{ slug: "snapdragon", commonName: "Snapdragon", varietyCount: 12, sellerCount: 4 }] }));
    expect(html).toContain("Snapdragon");
    expect(html).toContain("12 varieties · 4 sellers");
    expect(html).toContain("/admin/varieties?crop=snapdragon");
    expect(html).not.toContain("Edit");
  });
});

const F2_DETAIL: VarietyDetailData = {
  slug: "chantilly-purple",
  name: "Chantilly Purple",
  status: "active",
  plantSlug: "snapdragon",
  commonName: "Snapdragon",
  latinName: "Antirrhinum majus",
  seriesName: "Chantilly",
  listingCounts: [
    { word: "Active", n: 2 },
    { word: "Retired", n: 1 },
  ],
  listingTotal: 3,
  liveListingCount: 0,
  aliases: [
    { alias: "Chantilly Light Purple", source: "duplicate_decision", decidedByName: "Rae", createdAt: "2026-11-20T22:14:00.000Z" },
    { alias: "Chantilly Lilac", source: null, decidedByName: null, createdAt: null },
  ],
  waitlistCount: 12,
};
const F2_CTX = { variety: "chantilly-purple", tab: "varieties", q: null, crop: null, show: "50" };

describe("F2 detail", () => {
  const adminHtml = renderToStaticMarkup(createElement(VarietyDetail, { detail: F2_DETAIL, role: "admin", ctx: F2_CTX, backHref: "/admin/varieties", genericStatus: null }));

  it("renders the header, public link, listings summary and waitlist", () => {
    expect(adminHtml).toContain("Chantilly Purple");
    expect(adminHtml).toContain("Snapdragon");
    expect(adminHtml).toContain("Chantilly series");
    expect(adminHtml).toContain("Antirrhinum majus");
    expect(adminHtml).toContain("View public page");
    expect(adminHtml).toContain("3 listings");
    expect(adminHtml).toContain("Retired");
    expect(adminHtml).toContain("/admin/listings?variety=chantilly-purple");
    expect(adminHtml).toContain("12 people waiting");
    expect(adminHtml).toContain("/admin/statistics");
  });

  it("hides the public link when the variety is not publicly visible", () => {
    const draft = renderToStaticMarkup(
      createElement(VarietyDetail, { detail: { ...F2_DETAIL, status: "draft" }, role: "admin", ctx: F2_CTX, backHref: "/admin/varieties", genericStatus: null }),
    );
    expect(draft).not.toContain("View public page");
  });

  it("labels decision aliases and offers remove only on manual ones (RA-1)", () => {
    expect(adminHtml).toContain("Added from a duplicate decision");
    expect(adminHtml).toContain("Nov 20, 2026");
    expect(adminHtml).toContain("by Rae");
    expect(adminHtml).toContain("another name for this variety");
    expect(adminHtml).toContain("Add another name");
    // One remove control (the manual alias) — none for the decision alias.
    expect(adminHtml.match(/Remove the name/g)).toHaveLength(1);
    expect(adminHtml).toContain("Remove the name &#x27;Chantilly Lilac&#x27;");
  });

  it("renders fully read-only for reviewers", () => {
    const reviewerHtml = renderToStaticMarkup(createElement(VarietyDetail, { detail: F2_DETAIL, role: "reviewer", ctx: F2_CTX, backHref: "/admin/varieties", genericStatus: null }));
    expect(reviewerHtml).not.toContain("Add another name");
    expect(reviewerHtml).not.toContain("Remove the name");
    expect(reviewerHtml).not.toContain("Danger zone");
    expect(reviewerHtml).not.toContain("Remove variety");
    expect(reviewerHtml).toContain("Added from a duplicate decision"); // labels stay
  });

  it("blocks removal in words while live listings exist, with no confirm offered", () => {
    const blocked = renderToStaticMarkup(
      createElement(VarietyDetail, { detail: { ...F2_DETAIL, liveListingCount: 2 }, role: "admin", ctx: F2_CTX, backHref: "/admin/varieties", genericStatus: null }),
    );
    expect(blocked).toContain("This variety has 2 live listings. Retire them before removing the variety.");
    expect(blocked).toContain("/admin/listings?variety=chantilly-purple");
    expect(blocked).not.toContain("Remove variety");
  });

  it("offers Remove variety at zero live listings", () => {
    expect(adminHtml).toContain("Danger zone");
    expect(adminHtml).toContain("Remove variety");
  });

  it("carries one field + the consequence line in the add-name sheet", () => {
    const form = renderToStaticMarkup(createElement(AddAliasForm, { ctx: F2_CTX }));
    expect(form).toContain('name="name"');
    expect(form).toContain("This name will find this variety in search.");
    expect(form).toContain("Add name");
  });
});

// ─── G1/G2 components ─────────────────────────────────────────────────────────

const G1_ROWS = [
  { id: 1, name: "Dustin", displayName: null, email: "dustin@example.com", createdAt: "2026-11-01T18:00:00.000Z", role: "admin", isFarmOwner: true },
  { id: 2, name: "", displayName: "Rae", email: "rae@example.com", createdAt: "2026-11-02T18:00:00.000Z", role: "reviewer", isFarmOwner: false },
  { id: 3, name: "", displayName: null, email: "visitor@example.com", createdAt: "2026-11-03T18:00:00.000Z", role: "visitor", isFarmOwner: false },
];

describe("G1 list", () => {
  const html = renderToStaticMarkup(createElement(AccountList, { rows: G1_ROWS, total: 3, params: { q: null, show: 50 }, selected: 1 }));

  it("renders names, emails, joined dates and flag chips as words", () => {
    expect(html).toContain("Dustin");
    expect(html).toContain("dustin@example.com");
    expect(html).toContain("Joined Nov 1, 2026");
    expect(html).toContain("Rae");
    expect(html).toContain("visitor@example.com");
    expect(html).toContain(">Admin<");
    expect(html).toContain(">Reviewer<");
    expect(html).toContain(">Farm owner<");
    expect(html).toContain("3 accounts");
  });

  it("offers Clear search on no results", () => {
    const empty = renderToStaticMarkup(createElement(AccountList, { rows: [], total: 0, params: { q: "zzz", show: 50 }, selected: null }));
    expect(empty).toContain("No accounts match");
    expect(empty).toContain("Clear search");
  });
});

const G2_DETAIL: AccountDetailData = {
  id: 2,
  name: "Rae Reviewer",
  displayName: "Rae",
  email: "rae@example.com",
  phone: "5551234567",
  createdAt: "2026-11-02T18:00:00.000Z",
  role: "reviewer",
  status: "active",
  isFarmOwner: false,
  farmSeller: null,
  waitlistCount: 4,
  roleAudit: [{ toRole: "reviewer", createdAt: "2026-11-20T22:14:00.000Z", actor: "Dustin" }],
  farmOwnerAudit: [],
};
const G2_CTX = { account: "2", q: null, show: "50" };
const SELLER_OPTIONS = [{ slug: "songbird-seed-co", name: "Songbird Seed Co.", location: "Skagit Valley, WA" }];

describe("G2 detail", () => {
  const html = renderToStaticMarkup(createElement(AccountDetail, { detail: G2_DETAIL, self: false, ctx: G2_CTX, backHref: "/admin/accounts", genericStatus: null, sellerOptions: SELLER_OPTIONS }));

  it("renders the account facts and both panels", () => {
    expect(html).toContain("Rae");
    expect(html).toContain("rae@example.com");
    expect(html).toContain("5551234567");
    expect(html).toContain("Joined:");
    expect(html).toContain("Nov 2, 2026");
    expect(html).toContain("Waiting lists:");
    expect(html).toContain("Active");
    expect(html).toContain("Reviewer");
    expect(html).toContain("Change role");
    expect(html).toContain("Reviewer since Nov 20, 2026");
    expect(html).toContain("set by Dustin");
    expect(html).toContain("Not a farm owner.");
    expect(html).toContain("Set as farm owner");
  });

  it("hides the role controls on self-view with the explanation", () => {
    const self = renderToStaticMarkup(createElement(AccountDetail, { detail: G2_DETAIL, self: true, ctx: G2_CTX, backHref: "/admin/accounts", genericStatus: null, sellerOptions: [] }));
    expect(self).not.toContain("Change role");
    expect(self).toContain("You can&#x27;t change your own role.");
  });

  it("shows the farm-owner state, revoke and audit history", () => {
    const owner = renderToStaticMarkup(
      createElement(
        AccountDetail,
        {
          detail: { ...G2_DETAIL, isFarmOwner: true, farmSeller: { slug: "songbird-seed-co", name: "Songbird Seed Co." }, farmOwnerAudit: [{ action: "granted", createdAt: "2026-11-20T22:14:00.000Z", actor: "Dustin" }] },
          self: false,
          ctx: G2_CTX,
          backHref: "/admin/accounts",
          genericStatus: null,
          sellerOptions: [],
        },
      ),
    );
    expect(owner).toContain("Farm owner of");
    expect(owner).toContain("Songbird Seed Co.");
    expect(owner).toContain("/admin/sellers?seller=songbird-seed-co");
    expect(owner).toContain("Remove farm-owner status");
    expect(owner).toContain("Granted Nov 20, 2026");
    expect(owner).toContain("by Dustin");
  });

  it("renders the verbatim role cards and the grant-admin confirm", () => {
    const form = renderToStaticMarkup(createElement(RoleForm, { accountName: "Rae", currentRole: "reviewer", ctx: G2_CTX }));
    for (const c of ROLE_CARDS) {
      expect(form).toContain(c.title);
      expect(form).toContain(c.words.replaceAll("'", "&#x27;"));
    }
    const confirm = renderToStaticMarkup(createElement(GrantAdminConfirmView, { accountName: "Rae", busy: false, onBack: () => {} }));
    expect(confirm).toContain("Rae will be able to edit and remove sellers and give other people roles.");
    expect(confirm).toContain("Grant admin");
    expect(confirm).toContain("btn-danger");
  });

  it("renders the seller picker and the grant confirm", () => {
    const form = renderToStaticMarkup(createElement(FarmOwnerForm, { accountName: "Rae", sellers: SELLER_OPTIONS, ctx: G2_CTX }));
    expect(form).toContain("Find their farm");
    expect(form).toContain("Songbird Seed Co.");
    const confirm = renderToStaticMarkup(createElement(GrantFarmOwnerConfirmView, { accountName: "Rae", sellerName: "Songbird Seed Co.", busy: false, onBack: () => {} }));
    expect(confirm).toContain("Rae will be marked as the owner of Songbird Seed Co.");
  });
});

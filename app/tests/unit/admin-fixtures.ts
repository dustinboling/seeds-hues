/**
 * Slice 7 admin fixtures: the stub backend's admin sessions, review queue,
 * sellers (+ internal notes), varieties, listings, accounts, statistics, the
 * verbatim action-payload log, and per-endpoint accept/reject modes. The
 * stub (tests/stub/api-server.ts) plays the unchanged v2 backend's admin
 * data layer from this state; the suite drives the app's admin surfaces
 * and handlers against it and asserts on this state.
 *
 * Fixture (i): sessions — Dustin (full admin), Ruth (reviewer), Willa
 * (signed-in-but-unauthorized visitor), signed-out (no cookie), an AGED but
 * still-valid admin session (no idle timeout — valid until expiry), and an
 * EXPIRED admin session (absolute 7-day expiry only).
 *
 * Fixture (ii): review queue — 101 listing_match (publishes onto
 * cosmos-lonely-bloom), 102 structured seller_correction (Prairie location
 * fix, applies immediately), 103 duplicate_hold ("King's Ransom Select" ~
 * sweet-pea-kings-ransom, decideDuplicate only), 104 false-queue report (a
 * removal report whose listing is already live — rejectable), 105 removal
 * report (admin-only apply; reviewers are refused).
 *
 * Fixture (iii): sellers — blue-ridge-seeds (approved + Small farm, two
 * locations, CS contacts, internal notes), prairie-seed-house (approved,
 * no badge, internal note), geoseed (candidate, no badge), angletok
 * (ineligible — never public). Note markers NOTE-BLUERIDGE-7A /
 * NOTE-PRAIRIE-7B must NEVER appear in any public payload.
 *
 * Fixture (iv): varieties — sweet-pea-kings-ransom (3 live listings:
 * removal BLOCKED naming the count), cosmos-lonely-bloom (none: removal
 * allowed, then the public surface 404s); listing 501 for listing-remove
 * (idempotent: second call already_removed, no state change).
 *
 * Fixture (v): statistics — four popularity signals with hand-computable
 * rankings (each signal orders differently) + the Visitors card data shape
 * v2 consumes (dark by design: Web Analytics not connected).
 *
 * Fixture (vi): received[] records every action payload verbatim BEFORE
 * its mode applies; modes flip an endpoint group to reject (422 with
 * field detail — the BusyForm rejection drive).
 *
 * Prices live in source data ONLY (internalPrices): no admin or public
 * payload, and no admin HTML, may surface them.
 */

export type AdminRole = "admin" | "reviewer" | "visitor";

export interface AdminAccountFixture {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "banned";
  /** The 6-digit code the stub accepts for this account's email. */
  code: string;
  isFarmOwner: boolean;
  sellerId: number | null;
  waitlists: number;
  joinedAt: string;
}

export interface AdminSessionFixture {
  token: string;
  email: string;
  createdAt: string;
  /** Absolute expiry (7 days after creation). Deliberately no idle timeout:
   * no age-based invalidation field exists here — sessions stay valid at
   * any age until expiry, sign-out, or revocation (Dustin's ruling). */
  expiresAt: string;
}

export type ReviewItemType = "listing_match" | "seller_correction" | "duplicate_hold" | "removal" | "seller_candidate";

export interface FarmSubmissionFixture {
  id: number;
  status: "pending" | "approved" | "rejected";
  farmName: string;
  contactName: string;
  contactEmail: string;
  city: string;
  state: string;
  website: string;
  growsText: string;
  varietiesText: string;
  businessPhone: string;
  wholesale: string;
  notes: string;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface ReviewItemFixture {
  id: number;
  kind: "review";
  type: ReviewItemType;
  status: "pending" | "approved" | "rejected" | "merged";
  createdAt: string;
  decidedByName: string | null;
  resolvedAt: string | null;
  reason: string | null;
  proposal: Record<string, unknown>;
}

export interface AdminSellerFixture {
  id: number;
  slug: string;
  name: string;
  type: string;
  platform: string | null;
  homepage: string | null;
  contactEmail: string | null;
  /** Public customer-service contacts (rendered on the shop page). */
  csPhone: string | null;
  csEmail: string | null;
  location: string | null;
  locations: { kind: string; label: string; primary: boolean }[];
  region: string | null;
  country: string;
  shipsTo: string;
  description: string | null;
  orderingNotes: string | null;
  status: "active" | "inactive";
  eligibility: "approved" | "candidate" | "ineligible";
  listingPolicy: string;
  isSmallFarm: boolean;
  notes: { id: number; authorName: string; authorRole: string; body: string; createdAt: string }[];
  listings: { id: number; titleRaw: string | null; status: string; varietyName: string; varietySlug: string }[];
}

export interface AdminVarietyFixture {
  id: number;
  slug: string;
  name: string;
  crop: string;
  cropCommon: string;
  liveListings: number;
  aliases: { alias: string; source: "duplicate_decision" | "manual" | "primary"; decidedByName: string | null; createdAt: string | null }[];
  waiters: number;
  /** Soft removal (v2 removeVariety): set on remove, never a delete. */
  deletedAt: string | null;
}

export interface AdminListingFixture {
  id: number;
  varietySlug: string;
  varietyName: string;
  sellerSlug: string;
  sellerName: string;
  titleRaw: string | null;
  productUrl: string | null;
  status: "active" | "published" | "sold_out" | "removed";
  packets: { label: string; seedCount: number }[];
  lastCheckedAt: string | null;
  history: { event: string; at: string; actor: string | null; reason: string | null }[];
}

export type AdminEndpointKey =
  | "decide"
  | "sellerActions"
  | "varietyActions"
  | "listingActions"
  | "accountActions"
  | "signInRequest"
  | "signInVerify";

export type AdminMode = "accept" | "reject";

export interface AdminState {
  /** Fixed "now" the stub reads for session expiry (tests may advance it). */
  now: string;
  accounts: AdminAccountFixture[];
  sessions: AdminSessionFixture[];
  /** Fresh codes issued by sign-in request (email -> code). */
  issuedCodes: Record<string, string>;
  review: ReviewItemFixture[];
  farmSubmissions: FarmSubmissionFixture[];
  sellers: AdminSellerFixture[];
  varieties: AdminVarietyFixture[];
  listings: AdminListingFixture[];
  /** Source-data prices: internal ONLY — must never surface (see above). */
  internalPrices: Record<string, string>;
  statistics: AdminStatisticsFixture;
  /** Every admin action payload the stub received, verbatim, in order. */
  received: { endpoint: string; body: unknown }[];
  modes: Record<AdminEndpointKey, AdminMode>;
  /** The key-API admin key the stub accepts (x-admin-key). */
  apiKey: string;
  /** Aliases added by duplicate decisions (held name -> existing variety). */
  decisionAliases: { alias: string; varietySlug: string; itemId: number; decidedByName: string; createdAt: string }[];
}

export interface AdminStatisticsFixture {
  periodWords: string;
  dataSince: string;
  views: { slug: string; name: string; crop: string; cur: number; prev: number }[];
  clicks: { slug: string; name: string; crop: string; cur: number; prev: number; botsExcluded: number }[];
  waitlist: { slug: string; name: string; crop: string; waiters: number; verified: number; sellers: number }[];
  searches: { term: string; count: number; finds: { slug: string; name: string } | null }[];
  fruitless: { term: string; count: number }[];
  accountsTotal: number;
  accountsPrev: number;
  waitlistSignups: number;
  waitlistSignupsPrev: number;
  clicksTotal: number;
  clicksPrev: number;
}

export const ADMIN_SIGNIN_CODE_TTL_MINUTES = 10;

/** The stub's fixed clock (2026-11-24 noon UTC — inside every fixture window). */
export const ADMIN_NOW = "2026-11-24T12:00:00.000Z";

export function fakeAdminState(): AdminState {
  return {
    now: ADMIN_NOW,
    accounts: [
      { id: 1, name: "Dustin", email: "dustin@hues.flowers", role: "admin", status: "active", code: "111111", isFarmOwner: false, sellerId: null, waitlists: 0, joinedAt: "2026-01-05T00:00:00.000Z" },
      { id: 2, name: "Ruth Reviewer", email: "ruth@example.com", role: "reviewer", status: "active", code: "222222", isFarmOwner: false, sellerId: null, waitlists: 1, joinedAt: "2026-10-02T00:00:00.000Z" },
      { id: 3, name: "Willa Gardener", email: "willa@example.com", role: "visitor", status: "active", code: "333333", isFarmOwner: false, sellerId: null, waitlists: 2, joinedAt: "2026-09-01T00:00:00.000Z" },
      { id: 4, name: "Sam Seedbuyer", email: "sam@example.com", role: "visitor", status: "active", code: "444444", isFarmOwner: true, sellerId: 1, waitlists: 0, joinedAt: "2026-11-01T00:00:00.000Z" },
    ],
    sessions: [
      // Fresh privileged sessions.
      { token: "admin-session-token-7a", email: "dustin@hues.flowers", createdAt: "2026-11-24T08:00:00.000Z", expiresAt: "2026-12-01T08:00:00.000Z" },
      { token: "reviewer-session-token-7b", email: "ruth@example.com", createdAt: "2026-11-24T08:00:00.000Z", expiresAt: "2026-12-01T08:00:00.000Z" },
      // Signed-in-but-unauthorized: a valid session on a visitor account.
      { token: "visitor-session-token-7c", email: "willa@example.com", createdAt: "2026-11-24T08:00:00.000Z", expiresAt: "2026-12-01T08:00:00.000Z" },
      // AGED but unexpired (6.5 days old): valid — no idle timeout exists.
      { token: "aged-admin-session-7d", email: "dustin@hues.flowers", createdAt: "2026-11-17T23:00:00.000Z", expiresAt: "2026-11-24T23:00:00.000Z" },
      // EXPIRED (absolute 7-day lifetime only): refused, with the A3 welcome-back.
      { token: "expired-admin-session-7e", email: "dustin@hues.flowers", createdAt: "2026-11-16T12:00:00.000Z", expiresAt: "2026-11-23T12:00:00.000Z" },
    ],
    issuedCodes: {},
    review: [
      {
        id: 101,
        kind: "review",
        type: "listing_match",
        status: "pending",
        createdAt: "2026-11-20T09:00:00.000Z",
        decidedByName: null,
        resolvedAt: null,
        reason: null,
        proposal: {
          extracted_name: "Lonely Bloom",
          crop: "cosmos",
          variety_id: 2,
          variety_slug: "cosmos-lonely-bloom",
          seller_id: 1,
          match: { method: "model", confidence: 0.87, candidates: ["Candy Stripe"] },
          listing: {
            titleRaw: "Cosmos Lonely Bloom — 25 seeds",
            productUrl: "https://shop.example.com/blue-ridge/lonely-bloom",
            availability: "in_stock",
            checkedAt: "2026-11-20T08:00:00.000Z",
            packets: [{ label: "25 seeds", seedCount: 25 }],
          },
        },
      },
      {
        id: 102,
        kind: "review",
        type: "seller_correction",
        status: "pending",
        createdAt: "2026-11-21T10:00:00.000Z",
        decidedByName: null,
        resolvedAt: null,
        reason: null,
        proposal: {
          report: { type: "correct", target_type: "seller", target_ref: "prairie-seed-house", message: "Prairie Seed House moved down the road — the listing still shows the old town." },
          fields: { location: "Eudora, KS", region: "KS" },
        },
      },
      {
        id: 103,
        kind: "review",
        type: "duplicate_hold",
        status: "pending",
        createdAt: "2026-11-22T11:00:00.000Z",
        decidedByName: null,
        resolvedAt: null,
        reason: null,
        proposal: {
          held_name: "King's Ransom Select",
          crop: "sweet-pea",
          seller_id: 1,
          candidate: { variety_id: 1, name: "King's Ransom" },
          evidence_quote: "Listed as King's Ransom Select, a reselection of King's Ransom.",
          hold_reason: "The scout held this: the name is close to an existing variety.",
          listing: {
            titleRaw: "Sweet Pea King's Ransom Select",
            productUrl: "https://shop.example.com/blue-ridge/kings-ransom-select",
            availability: "in_stock",
            checkedAt: "2026-11-22T10:00:00.000Z",
          },
        },
      },
      {
        // The false-queue item: a removal report whose listing is already
        // live — there is nothing to act on, so it is rejectable.
        id: 104,
        kind: "review",
        type: "removal",
        status: "pending",
        createdAt: "2026-11-23T09:00:00.000Z",
        decidedByName: null,
        resolvedAt: null,
        reason: null,
        proposal: {
          report: { type: "remove", target_type: "seller", target_ref: "prairie-seed-house", message: "Please remove this seller — actually never mind, they are still selling." },
          listing_id: 2,
          live: true,
        },
      },
      {
        // A genuine removal report: admin-only apply; reviewers are refused.
        id: 105,
        kind: "review",
        type: "removal",
        status: "pending",
        createdAt: "2026-11-23T10:00:00.000Z",
        decidedByName: null,
        resolvedAt: null,
        reason: null,
        proposal: {
          report: { type: "remove", target_type: "seller", target_ref: "angletok", message: "This seller asked to be removed from the directory." },
        },
      },
      {
        // A hunt-found seller candidate (both roles approve/decline).
        id: 106,
        kind: "review",
        type: "seller_candidate",
        status: "pending",
        createdAt: "2026-11-19T08:00:00.000Z",
        decidedByName: null,
        resolvedAt: null,
        reason: null,
        proposal: { name: "Foxglove Farm", domain: "foxglovefarm.example.com", website_url: "https://foxglovefarm.example.com" },
      },
    ],
    farmSubmissions: [
      {
        id: 201,
        status: "pending",
        farmName: "Quinn Probe Acres",
        contactName: "Quinn Probe",
        contactEmail: "quinn@example.com",
        city: "Eugene",
        state: "OR",
        website: "https://quinnprobeacres.example.com",
        growsText: "Sweet peas and cosmos",
        varietiesText: "King's Ransom and others",
        businessPhone: "(541) 555-0100",
        wholesale: "no",
        notes: "Second-year farm.",
        createdAt: "2026-11-18T09:00:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
      },
    ],
    sellers: [
      {
        id: 1,
        slug: "blue-ridge-seeds",
        name: "Blue Ridge Seeds",
        type: "retail",
        platform: "shopify",
        homepage: "https://blueridgeseeds.example.com",
        contactEmail: "hello@blueridgeseeds.example.com",
        csPhone: "(503) 555-0114",
        csEmail: "help@blueridgeseeds.example.com",
        location: "Portland, OR",
        locations: [
          { kind: "physical", label: "Portland, OR", primary: true },
          { kind: "mailing", label: "PO Box 1408, Portland, OR", primary: false },
        ],
        region: "OR",
        country: "US",
        shipsTo: "US",
        description: "A family farm selling open-pollinated flower seed.",
        orderingNotes: "Ships in March.",
        status: "active",
        eligibility: "approved",
        listingPolicy: "standard",
        isSmallFarm: true,
        notes: [
          { id: 1, authorName: "Dustin", authorRole: "admin", body: "Called about spring shipping dates — confirm before March. NOTE-BLUERIDGE-7A", createdAt: "2026-11-20T14:14:00.000Z" },
        ],
        listings: [
          { id: 1, titleRaw: "Sweet Pea King's Ransom — 25 seeds", status: "active", varietyName: "King's Ransom", varietySlug: "sweet-pea-kings-ransom" },
        ],
      },
      {
        id: 2,
        slug: "prairie-seed-house",
        name: "Prairie Seed House",
        type: "wholesale",
        platform: null,
        homepage: "https://prairieseedhouse.example.com",
        contactEmail: "orders@prairieseedhouse.example.com",
        csPhone: "(785) 555-0199",
        csEmail: "care@prairieseedhouse.example.com",
        location: "Lawrence, KS",
        locations: [{ kind: "physical", label: "Lawrence, KS", primary: true }],
        region: "KS",
        country: "US",
        shipsTo: "US, CA",
        description: "Wholesale seed house with a retail shelf.",
        orderingNotes: null,
        status: "active",
        eligibility: "approved",
        listingPolicy: "standard",
        isSmallFarm: false,
        notes: [
          { id: 2, authorName: "Ruth Reviewer", authorRole: "reviewer", body: "Wholesale minimums change in January — recheck then. NOTE-PRAIRIE-7B", createdAt: "2026-11-21T16:30:00.000Z" },
        ],
        listings: [
          { id: 2, titleRaw: "Sweet Pea King's Ransom — 50 seeds", status: "active", varietyName: "King's Ransom", varietySlug: "sweet-pea-kings-ransom" },
        ],
      },
      {
        id: 3,
        slug: "geoseed",
        name: "GeoSeed",
        type: "retail",
        platform: "woocommerce",
        homepage: "https://geoseed.example.com",
        contactEmail: null,
        csPhone: null,
        csEmail: null,
        location: "Clinton, SC",
        locations: [{ kind: "physical", label: "Clinton, SC", primary: true }],
        region: "SC",
        country: "US",
        shipsTo: "unknown",
        description: null,
        orderingNotes: null,
        status: "active",
        eligibility: "candidate",
        listingPolicy: "standard",
        isSmallFarm: false,
        notes: [],
        listings: [],
      },
      {
        id: 4,
        slug: "angletok",
        name: "AngleTok",
        type: "retail",
        platform: "other",
        homepage: null,
        contactEmail: null,
        csPhone: null,
        csEmail: null,
        location: null,
        locations: [],
        region: null,
        country: "US",
        shipsTo: "unknown",
        description: null,
        orderingNotes: null,
        status: "inactive",
        eligibility: "ineligible",
        listingPolicy: "removed",
        isSmallFarm: false,
        notes: [],
        listings: [],
      },
    ],
    varieties: [
      {
        id: 1,
        slug: "sweet-pea-kings-ransom",
        name: "King's Ransom",
        crop: "sweet-pea",
        cropCommon: "Sweet Pea",
        liveListings: 3,
        aliases: [{ alias: "Ransom", source: "manual", decidedByName: null, createdAt: null }],
        waiters: 4,
        deletedAt: null,
      },
      {
        id: 2,
        slug: "cosmos-lonely-bloom",
        name: "Lonely Bloom",
        crop: "cosmos",
        cropCommon: "Cosmos",
        liveListings: 0,
        aliases: [],
        waiters: 7,
        deletedAt: null,
      },
    ],
    listings: [
      {
        id: 501,
        varietySlug: "sweet-pea-kings-ransom",
        varietyName: "King's Ransom",
        sellerSlug: "blue-ridge-seeds",
        sellerName: "Blue Ridge Seeds",
        titleRaw: "Sweet Pea King's Ransom — trial packet",
        productUrl: "https://shop.example.com/blue-ridge/kings-ransom-trial",
        status: "active",
        packets: [{ label: "10 seeds", seedCount: 10 }],
        lastCheckedAt: "2026-11-20T08:00:00.000Z",
        history: [{ event: "first_seen", at: "2026-09-01T00:00:00.000Z", actor: null, reason: null }],
      },
      {
        id: 502,
        varietySlug: "cosmos-candy-stripe",
        varietyName: "Candy Stripe",
        sellerSlug: "prairie-seed-house",
        sellerName: "Prairie Seed House",
        titleRaw: "Cosmos Candy Stripe — 50 seeds",
        productUrl: "https://shop.example.com/prairie/candy-stripe",
        status: "removed",
        packets: [{ label: "50 seeds", seedCount: 50 }],
        lastCheckedAt: "2026-11-15T12:00:00.000Z",
        history: [
          { event: "first_seen", at: "2026-10-05T00:00:00.000Z", actor: null, reason: null },
          { event: "gone", at: "2026-11-16T00:00:00.000Z", actor: "Dustin", reason: "Dead link" },
        ],
      },
    ],
    internalPrices: {
      "listing-501": "$4.95",
      "listing-502": "$3.50",
      "packet-note": "priceCents:495",
    },
    statistics: {
      periodWords: "Nov 17 – Nov 23, 2026",
      dataSince: "2026-11-01",
      // Hand-computed ranks — current: alpha 1, beta 2, gamma 3;
      // previous: beta 1, alpha 2, gamma 3 (alpha up, beta down, gamma same).
      views: [
        { slug: "cosmos-candy-stripe", name: "Candy Stripe", crop: "Cosmos", cur: 120, prev: 80 },
        { slug: "sweet-pea-kings-ransom", name: "King's Ransom", crop: "Sweet Pea", cur: 90, prev: 100 },
        { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", crop: "Cosmos", cur: 60, prev: 70 },
      ],
      // A DIFFERENT order (gamma first) — and 50 bot clicks on beta that
      // must be excluded: served beta = 10, never 60.
      clicks: [
        { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", crop: "Cosmos", cur: 40, prev: 5, botsExcluded: 0 },
        { slug: "cosmos-candy-stripe", name: "Candy Stripe", crop: "Cosmos", cur: 25, prev: 30, botsExcluded: 0 },
        { slug: "sweet-pea-kings-ransom", name: "King's Ransom", crop: "Sweet Pea", cur: 10, prev: 12, botsExcluded: 50 },
      ],
      // The CURRENT waiting list — identical at every range.
      waitlist: [
        { slug: "cosmos-lonely-bloom", name: "Lonely Bloom", crop: "Cosmos", waiters: 7, verified: 5, sellers: 0 },
        { slug: "cosmos-mystery-bloom", name: "Mystery Bloom", crop: "Cosmos", waiters: 5, verified: 5, sellers: 0 },
        { slug: "sweet-pea-kings-ransom", name: "King's Ransom", crop: "Sweet Pea", waiters: 2, verified: 1, sellers: 2 },
      ],
      searches: [
        { term: "cosmos", count: 30, finds: { slug: "cosmos-candy-stripe", name: "Candy Stripe" } },
        { term: "ransom", count: 12, finds: { slug: "sweet-pea-kings-ransom", name: "King's Ransom" } },
        { term: "lonely blum", count: 4, finds: null },
      ],
      fruitless: [{ term: "xyz-no-match", count: 5 }],
      accountsTotal: 18,
      accountsPrev: 12,
      waitlistSignups: 9,
      waitlistSignupsPrev: 9,
      clicksTotal: 75,
      clicksPrev: 47,
    },
    received: [],
    modes: {
      decide: "accept",
      sellerActions: "accept",
      varietyActions: "accept",
      listingActions: "accept",
      accountActions: "accept",
      signInRequest: "accept",
      signInVerify: "accept",
    },
    apiKey: "test-admin-key-7",
    decisionAliases: [],
  };
}

/** Queue membership for a review item type (v2 review-queues QUEUES). */
export function queueForType(type: string): string | null {
  if (type === "duplicate_hold") return "duplicates";
  if (type === "seller_candidate" || type === "farm_submission") return "sellers";
  if (type === "listing_match" || type === "new_variety") return "listings";
  if (type === "seller_correction" || type === "removal") return "reports";
  return null;
}

/**
 * Slice 6 form/account fixtures: the stub backend's visitor accounts,
 * waitlist entries, payload log, per-endpoint modes, /go listings, click
 * log, and unsubscribe tokens. The stub (tests/stub/api-server.ts) plays
 * the unchanged v2 backend from this state; the suite drives the app's
 * pages, forms, and relays against it and asserts on this state.
 *
 * Fixture (i): Willa Gardener — full account (name/email/phone/ZIP) with an
 * existing waitlist entry on the zero-seller variety cosmos-lonely-bloom
 * in the "found" alert state (seller Blue Ridge Seeds, listing 1); plus a
 * second entry in "waiting" and a third account-wide "held" demonstration
 * via notify opt-out toggling in-test. Fixture (i-b): phone-less account
 * (email only — the §11.1 "Email me a code instead" seam case).
 */
export type FormsMode = "accept" | "validation_error" | "rate_limited" | "turnstile_failed";

export type FormsEndpointKey =
  | "reports"
  | "farm"
  | "create"
  | "signIn"
  | "signInCode"
  | "signInVerify"
  | "waitlistJoin"
  | "joinForm"
  | "verifyForm"
  | "waitlistVerify"
  | "unsubscribe";

export interface FormsAccountFixture {
  id: number;
  name: string;
  email: string;
  /** Normalized 10-digit digits, or "" for a phone-less account (§11.1). */
  phone: string;
  phoneDisplay: string;
  zip: string | null;
  zone: string | null;
  emailVerified: boolean;
  smsOptIn: boolean;
  alertPhone: string | null;
  alertPhoneVerified: boolean;
  notifyOptOut: boolean;
  farmOwnerDeclared: boolean;
  isFarmOwner: boolean;
  /** The 6-digit code the stub accepts for this account's email. */
  code: string;
}

export interface FormsWaitlistEntry {
  email: string;
  varietySlug: string;
  varietyName: string;
  crop: string;
  joinedAt: string;
  notifiedAt: string | null;
  channels: ("email" | "sms")[];
  /** Null while waiting/held; set when the variety is found. */
  found: { sellerName: string; sellerSlug: string; listingId: number; sellerCount: number } | null;
}

export interface FormsGoListing {
  status: "active" | "removed" | "unpublished";
  target: string;
}

export interface FormsState {
  accounts: FormsAccountFixture[];
  /** Session token -> account email (the stub's session store). */
  sessions: Record<string, string>;
  waitlists: FormsWaitlistEntry[];
  /** Every form/account payload the stub received, verbatim, in order. */
  received: { endpoint: string; body: unknown }[];
  modes: Record<FormsEndpointKey, FormsMode>;
  /** The Turnstile site key the stub reports (null = not configured). */
  turnstileSiteKey: string | null;
  goListings: Record<number, FormsGoListing>;
  clicks: { listingId: number; at: string }[];
  unsubTokens: { valid: string; tampered: string; scope: { kind: "variety"; varietySlug: string; varietyName: string } };
  /** Tokens whose subscription already flipped (one-click is idempotent-safe). */
  unsubscribed: string[];
  /** Recognized-contact pending joins: email -> variety slug. */
  pendingJoins: Record<string, string>;
}

export function fakeFormsState(): FormsState {
  return {
    accounts: [
      {
        id: 1,
        name: "Willa Gardener",
        email: "willa@example.com",
        phone: "5035550114",
        phoneDisplay: "(503) 555-0114",
        zip: "97205",
        zone: "8b",
        emailVerified: true,
        smsOptIn: true,
        alertPhone: "5035550114",
        alertPhoneVerified: true,
        notifyOptOut: false,
        farmOwnerDeclared: false,
        isFarmOwner: false,
        code: "123456",
      },
      {
        id: 2,
        name: "",
        email: "phoneless@example.com",
        phone: "",
        phoneDisplay: "",
        zip: null,
        zone: null,
        emailVerified: false,
        smsOptIn: false,
        alertPhone: null,
        alertPhoneVerified: false,
        notifyOptOut: false,
        farmOwnerDeclared: false,
        isFarmOwner: false,
        code: "654321",
      },
    ],
    sessions: {},
    waitlists: [
      {
        email: "willa@example.com",
        varietySlug: "cosmos-lonely-bloom",
        varietyName: "Lonely Bloom",
        crop: "Cosmos",
        joinedAt: "2026-11-10T09:00:00.000Z",
        notifiedAt: "2026-11-21T08:00:00.000Z",
        channels: ["email", "sms"],
        found: { sellerName: "Blue Ridge Seeds", sellerSlug: "blue-ridge-seeds", listingId: 1, sellerCount: 2 },
      },
      {
        email: "willa@example.com",
        varietySlug: "cosmos-candy-stripe",
        varietyName: "Candy Stripe",
        crop: "Cosmos",
        joinedAt: "2026-11-12T09:00:00.000Z",
        notifiedAt: null,
        channels: ["email"],
        found: null,
      },
    ],
    received: [],
    modes: {
      reports: "accept",
      farm: "accept",
      create: "accept",
      signIn: "accept",
      signInCode: "accept",
      signInVerify: "accept",
      waitlistJoin: "accept",
      joinForm: "accept",
      verifyForm: "accept",
      waitlistVerify: "accept",
      unsubscribe: "accept",
    },
    turnstileSiteKey: "test-site-key",
    goListings: {
      // Fixture (iii): active listing 1 -> Blue Ridge product URL; 2 is
      // removed (the backend 410s — the app maps it to 404 per the brief);
      // 999 is unknown (backend 404s).
      1: { status: "active", target: "https://shop.example.com/blue-ridge/kings-ransom" },
      2: { status: "removed", target: "https://shop.example.com/prairie/kings-ransom" },
      3: { status: "active", target: "https://shop.example.com/blue-ridge/kings-ransom?color=red" },
      4: { status: "active", target: "https://shop.example.com/blue-ridge/kings-ransom?utm_source=newsletter" },
      7: { status: "unpublished", target: "https://shop.example.com/prairie/draft" },
    },
    clicks: [],
    // Fixture (iv): a signed token for Willa's Lonely Bloom entry and the
    // same token with a tampered signature (the stub verifies by equality
    // against these two fixtures — signature-shaped, 43-char tail).
    unsubTokens: {
      valid: "u1.v101.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      tampered: "u1.v101.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA",
      scope: { kind: "variety", varietySlug: "cosmos-lonely-bloom", varietyName: "Lonely Bloom" },
    },
    unsubscribed: [],
    pendingJoins: {},
  };
}

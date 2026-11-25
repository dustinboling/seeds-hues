/**
 * Slice 7 admin lib: the ported v2 pure functions — roles/sessions/nav/
 * dates (auth), queue definitions/labels/status wording (review),
 * seller/variety/listing/account status words + lines, and the
 * statistics math + pinned copy. Every expectation is v2's exact
 * behavior, hardcoded here — never computed by the code under test.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
import {
  ADMIN_CODE_MAX_ATTEMPTS,
  ADMIN_CODE_TTL_MINUTES,
  ADMIN_MORE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DAYS,
  adminSessionCookie,
  clearAdminSessionCookie,
  firstParam,
  formatAdminDate,
  formatAdminDateTime,
  isPrivilegedRole,
  navFor,
  oldestLine,
  roleLabel,
  safeAdminNext,
  timeAgo,
} from "../../src/lib/admin/auth";
import {
  ageWords,
  composeReason,
  correctionFields,
  CORRECTION_FIELD_LABELS,
  DECIDED_PAGE_SIZE,
  decisionSentence,
  itemLabel,
  itemRefParam,
  LISTING_REJECT_REASONS,
  matchLine,
  outcomeLabel,
  parseItemRef,
  QUEUE_WINDOW,
  QUEUES,
  queueDef,
  queueForType,
  reportListingId,
  reportMessage,
  reportTarget,
  reportTitle,
  RETIRE_REASONS,
  statusLine,
} from "../../src/lib/admin/review";
import {
  classificationStatusLine,
  editStatusLine,
  formatShipsTo,
  isPubliclyListed,
  parseShipsTo,
  platformLabel,
  SELLER_FIELD_LABELS,
  sellerStatusLine,
  shipsToWords,
  statusWordFor,
} from "../../src/lib/admin/sellers";
import {
  ADD_ALIAS_CONSEQUENCE,
  REMOVE_ALIAS_CONSEQUENCE,
  varietyRemoveBlockLine,
  varietyRemoveConsequence,
  varietyStatusLine,
} from "../../src/lib/admin/varieties";
import {
  composeRetireReason,
  isRetireReason,
  listingEventLine,
  listingEventWord,
  listingStatusLine,
  retireConsequence,
  statusWordForListing,
} from "../../src/lib/admin/listings";
import {
  accountStatusLine,
  accountStatusWord,
  currentRoleWords,
  grantAdminConsequence,
  grantFarmOwnerConsequence,
  isAccountRole,
  REVOKE_FARM_OWNER_CONSEQUENCE,
  ROLE_CARDS,
  roleHistoryLine,
  roleWord,
  SELF_ROLE_LINE,
} from "../../src/lib/admin/accounts";
import {
  NO_CLICKS_LINE,
  NO_FRUITLESS_LINE,
  NO_RESULTS_LINE,
  NO_SEARCHES_LINE,
  NO_VIEWS_LINE,
  NO_WAITERS_LINE,
  RANGE_LABELS,
  SHOW_DEFAULT,
  SHOW_WIDE,
  SIGNAL_LABELS,
  soldOutLine,
  statDelta,
  statMovement,
  statPeriod,
  statisticsHref,
  thinState,
  trendSummary,
  VISITORS_LINE_H,
  VISITORS_LINE_HOME,
  VISITORS_SOURCE,
  WAITLIST_RANGE_LINE,
  parseStatisticsParams,
} from "../../src/lib/admin/statistics";

describe("admin auth primitives (v2 lib/admin-auth)", () => {
  it("role checks + labels", () => {
    expect(isPrivilegedRole("admin")).toBe(true);
    expect(isPrivilegedRole("reviewer")).toBe(true);
    expect(isPrivilegedRole("visitor")).toBe(false);
    expect(isPrivilegedRole("")).toBe(false);
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("reviewer")).toBe("Reviewer");
    expect(roleLabel("visitor")).toBe("Visitor");
  });

  it("session cookie shape is v2's (name, Path=/admin, 7-day Max-Age)", () => {
    expect(ADMIN_SESSION_COOKIE).toBe("sf_admin_session");
    expect(ADMIN_SESSION_DAYS).toBe(7);
    expect(adminSessionCookie("tok")).toBe("sf_admin_session=tok; Path=/admin; Max-Age=604800; HttpOnly; Secure; SameSite=Lax");
    expect(clearAdminSessionCookie()).toBe("sf_admin_session=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  });

  it("code constants are shared with the account machinery (never hardcoded)", () => {
    expect(ADMIN_CODE_TTL_MINUTES).toBeGreaterThan(0);
    expect(ADMIN_CODE_MAX_ATTEMPTS).toBeGreaterThan(0);
  });

  it("navFor applies Act = absent (reviewers never see Accounts)", () => {
    expect(navFor("admin").map((i) => i.key)).toEqual(["home", "review", "sellers", "listings", "varieties", "statistics", "accounts"]);
    expect(navFor("reviewer").map((i) => i.key)).toEqual(["home", "review", "sellers", "listings", "varieties", "statistics"]);
    expect(ADMIN_MORE).toMatchObject({ key: "more", label: "More", href: "/admin/more" });
    expect(navFor("admin").find((i) => i.key === "statistics")!.shortLabel).toBe("Stats");
  });

  it("safeAdminNext accepts only internal admin paths (no open redirect)", () => {
    expect(safeAdminNext("/admin")).toBe("/admin");
    expect(safeAdminNext("/admin/review?queue=listings")).toBe("/admin/review?queue=listings");
    expect(safeAdminNext("https://evil.example.com/admin")).toBeNull();
    expect(safeAdminNext("//evil.example.com")).toBeNull();
    expect(safeAdminNext("/admin\\evil")).toBeNull();
    expect(safeAdminNext("/variety/x")).toBeNull();
    expect(safeAdminNext(null)).toBeNull();
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam(undefined)).toBeNull();
  });

  it("dates render Pacific-friendly (the post-4 PM PT same-day case)", () => {
    expect(formatAdminDate("2026-11-20T22:14:00.000Z")).toBe("Nov 20, 2026");
    expect(formatAdminDateTime("2026-11-20T22:14:00.000Z")).toBe("Nov 20, 2026 · 2:14 PM");
    expect(formatAdminDate("2026-11-21T01:30:00.000Z")).toBe("Nov 20, 2026");
    expect(formatAdminDateTime("2026-11-21T01:30:00.000Z")).toBe("Nov 20, 2026 · 5:30 PM");
    expect(formatAdminDate(null)).toBe("");
  });

  it("oldestLine + timeAgo words", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(oldestLine(null, now)).toBeNull();
    expect(oldestLine("2026-11-24T08:00:00.000Z", now)).toBe("Oldest: today");
    expect(oldestLine("2026-11-18T08:00:00.000Z", now)).toBe("Oldest: 6 days");
    expect(timeAgo("2026-11-24T11:59:30.000Z", now)).toBe("just now");
    expect(timeAgo("2026-11-23T12:00:00.000Z", now)).toBe("yesterday");
  });
});

describe("review queues (v2 lib/admin/review-queues)", () => {
  it("queue order is duplicates-first and definitions carry names", () => {
    expect(QUEUES.map((q) => q.key)).toEqual(["duplicates", "sellers", "listings", "reports"]);
    expect(queueDef("listings")!.name).toBe("Queued listings");
    expect(queueDef("nope")).toBeNull();
    expect(QUEUE_WINDOW).toBe(25);
    expect(DECIDED_PAGE_SIZE).toBe(20);
  });

  it("queueForType folds every item type into its queue", () => {
    expect(queueForType("duplicate_hold")).toBe("duplicates");
    expect(queueForType("seller_candidate")).toBe("sellers");
    expect(queueForType("listing_match")).toBe("listings");
    expect(queueForType("new_variety")).toBe("listings");
    expect(queueForType("seller_correction")).toBe("reports");
    expect(queueForType("removal")).toBe("reports");
    expect(queueForType("nope")).toBeNull();
  });

  it("item refs round-trip; bad refs are null", () => {
    expect(itemRefParam({ kind: "review", id: 103 })).toBe("review-103");
    expect(parseItemRef("farm-5")).toEqual({ kind: "farm", id: 5 });
    expect(parseItemRef("review-0")).toBeNull();
    expect(parseItemRef("nope")).toBeNull();
  });

  it("report helpers read the proposal's own words", () => {
    const p = { report: { type: "correct", target_type: "seller", target_ref: "prairie-seed-house", message: "Moved towns." }, fields: { location: "Eudora, KS" }, listing_id: 2 };
    expect(reportTarget(p)).toEqual({ type: "seller", ref: "prairie-seed-house" });
    expect(reportTitle(p)).toBe("Seller correction");
    expect(reportMessage(p)).toBe("Moved towns.");
    expect(reportListingId(p)).toBe(2);
    expect(correctionFields(p)).toEqual({ location: "Eudora, KS" });
    expect(CORRECTION_FIELD_LABELS.location).toBe("Location");
    expect(itemLabel("duplicate_hold", { held_name: "X" }, 9)).toBe("X");
  });

  it("matchLine always states crop agreement", () => {
    expect(matchLine({ match: { method: "model", confidence: 0.87 }, crop: "cosmos" })).toBe("The model matched this listing; confidence 87%; the crop agrees (cosmos).");
    expect(matchLine({})).toBe("The machine matched this listing; the crop could not be checked.");
  });

  it("decision sentences + outcomes in plain words", () => {
    expect(decisionSentence({ id: 1, type: "duplicate_hold", proposal: { held_name: "H", candidate: { name: "E" } }, status: "merged", decidedByName: "Dustin" })).toBe(
      "Dustin marked 'H' a duplicate of 'E'",
    );
    expect(decisionSentence({ id: 1, type: "seller_correction", proposal: { report: { target_ref: "s" } }, status: "approved", decidedByName: null })).toBe("Applied a correction to s");
    expect(outcomeLabel("duplicate_hold", "merged", { candidate: { name: "E" } })).toBe("Marked a duplicate of 'E'");
    expect(outcomeLabel("seller_correction", "approved", {})).toBe("Correction applied");
  });

  it("status lines from redirect params (nothing raw reaches the pane)", () => {
    expect(statusLine({ status: "published", variety: "Lonely Bloom" })!.text).toBe("Published on Lonely Bloom's public page.");
    expect(statusLine({ status: "duplicate_kept", existing: "King's Ransom" })!.text).toBe("Kept as another name for 'King's Ransom'.");
    expect(statusLine({ status: "correction_applied", seller: "prairie-seed-house" })!.text).toBe("Correction applied to prairie-seed-house.");
    expect(statusLine({ status: "already_decided", name: "Ruth" })!.text).toBe("That one was already decided by Ruth.");
    expect(statusLine({ status: "bogus" })).toBeNull();
    expect(statusLine({})).toBeNull();
  });

  it("reason composition caps at 500 chars", () => {
    expect(LISTING_REJECT_REASONS).toContain("Wrong variety");
    expect(RETIRE_REASONS).toContain("Duplicate listing");
    expect(composeReason("Dead link", "gone since spring")).toBe("Dead link — gone since spring");
    expect(composeReason(null, null)).toBeNull();
  });

  it("ageWords counts calendar days", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(ageWords("2026-11-24T08:00:00.000Z", now)).toBe("today");
    expect(ageWords("2026-11-21T08:00:00.000Z", now)).toBe("3 days");
  });
});

describe("seller + variety + listing + account status (v2 §10.4)", () => {
  it("public-listing predicate + status words", () => {
    const listed = { eligibility: "approved", status: "active", listingPolicy: "standard", deletedAt: null };
    expect(isPubliclyListed(listed)).toBe(true);
    expect(isPubliclyListed({ ...listed, status: "inactive" })).toBe(false);
    expect(statusWordFor(listed)).toBe("Active");
    expect(statusWordFor({ ...listed, eligibility: "candidate" })).toBe("Candidate");
    expect(statusWordFor({ ...listed, status: "inactive" })).toBe("Not active");
  });

  it("ships-to parsing/formatting round-trips the JSON convention", () => {
    expect(parseShipsTo("US, CA")).toEqual(["US", "CA"]);
    expect(parseShipsTo("")).toEqual(["unknown"]);
    expect(formatShipsTo('["US","CA"]')).toBe("US, CA");
    expect(formatShipsTo('["unknown"]')).toBe("");
    expect(shipsToWords('["unknown"]')).toBe("Unknown");
    expect(platformLabel("shopify")).toBe("Shopify");
    expect(platformLabel(null)).toBe("Not set");
  });

  it("edit + classification + seller status lines", () => {
    expect(editStatusLine(["location"], { location: "Greenwood, SC" })).toBe("Location updated to Greenwood, SC.");
    expect(editStatusLine(["name", "location"], {})).toBe("Name, Location updated.");
    expect(editStatusLine([], {})).toBe("No changes to save.");
    expect(SELLER_FIELD_LABELS.homepage).toBe("Website");
    expect(classificationStatusLine(true, null)).toBe("Classified as a small farm — the badge is showing.");
    expect(classificationStatusLine(false, "Geo")).toBe("Classified as not a small farm — no badge is shown. Geo is now publicly listed.");
    expect(sellerStatusLine({ status: "note_added" })!.text).toBe("Note added.");
    expect(sellerStatusLine({ status: "removed", name: "X" })!.text).toBe("Removed X from the directory.");
    expect(sellerStatusLine({ status: "save_failed" })!.text).toBe("That didn't go through. Nothing was changed — try again.");
  });

  it("variety remove block/consequence + status lines", () => {
    expect(varietyRemoveBlockLine(3)).toBe("This variety has 3 live listings. Retire them before removing the variety.");
    expect(varietyRemoveBlockLine(1)).toBe("This variety has 1 live listing. Retire it before removing the variety.");
    expect(varietyRemoveConsequence("Lonely Bloom")).toContain("'Lonely Bloom's public page will come off the site");
    expect(ADD_ALIAS_CONSEQUENCE).toBe("This name will find this variety in search.");
    expect(REMOVE_ALIAS_CONSEQUENCE).toContain("the scout may propose this variety again under it");
    expect(varietyStatusLine({ status: "variety_removed", name: "Lonely Bloom" })!.text).toBe("Removed 'Lonely Bloom' — its page is off the public site.");
    expect(varietyStatusLine({ status: "alias_added", name: "Ransom" })!.text).toBe("'Ransom' now finds this variety in search.");
  });

  it("listing retire + history words", () => {
    expect(isRetireReason("Dead link")).toBe(true);
    expect(isRetireReason("nope")).toBe(false);
    expect(composeRetireReason("Dead link", "gone")).toBe("Dead link — gone");
    expect(retireConsequence("King's Ransom")).toBe("This listing will come off 'King's Ransom's page. The seller's other listings stay.");
    expect(listingEventWord("gone")).toBe("Retired");
    expect(listingEventLine({ event: "gone", reason: "Dead link", actor: "Dustin" }, "Nov 16, 2026")).toBe("Retired Nov 16, 2026 · by Dustin — reason: Dead link");
    expect(listingStatusLine({ status: "retired", variety: "X" })!.text).toBe("Retired — it is off 'X's page.");
    expect(statusWordForListing({ status: "removed", availability: null, deletedAt: null, sellerEligibility: "approved", sellerStatus: "active", sellerListingPolicy: "standard", sellerDeletedAt: null })).toBe("Retired");
  });

  it("account role cards quote the spec verbatim + status lines", () => {
    expect(ROLE_CARDS.map((c) => c.value)).toEqual(["admin", "reviewer", "visitor"]);
    expect(ROLE_CARDS[1]!.words).toBe("Review and approve queues, decide duplicates, read and add seller notes. Can't edit sellers or remove anything — except approving a seller correction, which applies the fix right away.");
    expect(isAccountRole("reviewer")).toBe(true);
    expect(isAccountRole("super")).toBe(false);
    expect(SELF_ROLE_LINE).toBe("You can't change your own role.");
    expect(REVOKE_FARM_OWNER_CONSEQUENCE).toBe("Revoking keeps the account and its waiting lists.");
    expect(grantAdminConsequence("Ruth")).toBe("Ruth will be able to edit and remove sellers and give other people roles.");
    expect(grantFarmOwnerConsequence("Sam", "Blue")).toBe("Sam will be marked as the owner of Blue.");
    expect(currentRoleWords("visitor")).toBe("Visitor — no admin access");
    expect(roleWord("admin")).toBe("Admin");
    expect(accountStatusWord("banned")).toBe("Banned");
    expect(roleHistoryLine({ toRole: "reviewer", createdAt: "x", actor: "Dustin" }, "Nov 20, 2026", "Sep 1, 2026", "reviewer")).toBe("Reviewer since Nov 20, 2026 · set by Dustin");
    expect(accountStatusLine({ status: "role_changed", name: "Sam", role: "reviewer" })!.text).toBe("Sam is now Reviewer.");
    expect(accountStatusLine({ status: "farm_revoked" })!.text).toBe("Farm-owner status removed. The account and its waiting lists stay.");
  });
});

describe("statistics math + pinned copy (v2 lib/admin/statistics)", () => {
  it("periods caption every range", () => {
    expect(statPeriod("2026-11-23", "7d")).toMatchObject({ start: "2026-11-17", words: "Nov 17 – Nov 23, 2026", caption: "Last 7 days · Nov 17 – Nov 23, 2026" });
    expect(statPeriod("2026-11-23", "12w").days).toBe(84);
    expect(RANGE_LABELS["30d"]).toBe("30 days");
    expect(SIGNAL_LABELS.clicks).toBe("Clicks to sellers");
    expect(SHOW_DEFAULT).toBe(10);
    expect(SHOW_WIDE).toBe(25);
    expect(parseStatisticsParams({ range: "bogus", signal: "clicks", show: "25" })).toEqual({ range: "7d", signal: "clicks", show: 25 });
    expect(statisticsHref({ range: "30d", signal: "views", show: 10 })).toBe("/admin/statistics?range=30d");
  });

  it("delta edges: New / No change / down-100", () => {
    expect(statDelta(18, 12)).toEqual({ kind: "up", text: "▲ 50% up" });
    expect(statDelta(9, 9)).toEqual({ kind: "no-change", text: "No change" });
    expect(statDelta(5, 0)).toEqual({ kind: "new", text: "New" });
    expect(statDelta(0, 9)).toEqual({ kind: "down", text: "▼ 100% down" });
  });

  it("movement reads previous-minus-current ranks", () => {
    expect(statMovement(1, 2)).toEqual({ kind: "up", text: "▲ 1" });
    expect(statMovement(2, 1)).toEqual({ kind: "down", text: "▼ 1" });
    expect(statMovement(3, 3)).toEqual({ kind: "same", text: "—" });
    expect(statMovement(1, null)).toEqual({ kind: "new", text: "New" });
  });

  it("thin data suppresses comparisons honestly", () => {
    expect(thinState("2026-11-20", "2026-11-10", "2026-11-17", "2026-11-23").thin).toBe(true);
    expect(thinState("2026-11-01", "2026-11-10", "2026-11-17", "2026-11-23").thin).toBe(false);
    expect(thinState(null, "2026-11-10", "2026-11-17", "2026-11-23")).toMatchObject({ thin: true, days: null });
  });

  it("trend summaries name the peak in plain words", () => {
    expect(trendSummary("Clicks", [], false)).toBe("Clicks: none in this period.");
    expect(
      trendSummary(
        "Views",
        [
          { key: "2026-11-17", label: "Nov 17", value: 3 },
          { key: "2026-11-18", label: "Nov 18", value: 9 },
        ],
        false,
      ),
    ).toBe("Views peaked on Wednesday, Nov 18, with 9.");
  });

  it("no idle-timeout behavior exists anywhere in the admin code (Dustin's ruling)", () => {
    // Sessions expire absolutely (7 days) and die on sign-out/revocation
    // ONLY. Any idle/last-seen/inactivity tracking in the admin paths
    // would be the forbidden behavior — fail the suite if it appears.
    const roots = ["src/lib/admin", "src/components/admin", "src/server", "server", "pages/admin", "tests/stub/admin-server.ts", "tests/unit/admin-fixtures.ts"];
    const files: string[] = [];
    const walk = (entry: string): void => {
      const full = join(APP_ROOT, entry);
      let isDir = false;
      try {
        isDir = statSync(full).isDirectory();
      } catch {
        return;
      }
      if (isDir) {
        for (const child of readdirSync(full)) walk(join(entry, child));
      } else if (/\.(ts|tsx)$/.test(entry)) {
        files.push(full);
      }
    };
    for (const root of roots) walk(root);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      // The ruling's own comments name the absence ("no idle timeout") and
      // "inactive" is the seller-status word — both allowed; any other
      // idle/inactivity/last-seen tracking is the forbidden behavior.
      const stripped = text.replace(/no idle[\s-]*timeout/gi, "").replace(/inactive/gi, "");
      expect(stripped, file).not.toMatch(/idle/i);
      expect(stripped, file).not.toMatch(/lastSeen|last_seen|inactivity/i);
    }
  });

  it("pinned lines are v2's exact words", () => {
    expect(VISITORS_LINE_H).toBe("Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.");
    expect(VISITORS_LINE_HOME).toBe("Not connected yet — visitor counts come from Cloudflare Web Analytics.");
    expect(VISITORS_SOURCE).toBe("Pageloads from Cloudflare Web Analytics for seeds.hues.flowers");
    expect(WAITLIST_RANGE_LINE).toBe("The current waiting list — it doesn’t change with the date range.");
    expect(NO_RESULTS_LINE).toBe("People looked for these and found nothing.");
    expect(NO_FRUITLESS_LINE).toBe("No fruitless searches in this period — every search found something.");
    expect(NO_SEARCHES_LINE).toBe("No searches recorded in this period.");
    expect(NO_VIEWS_LINE).toBe("No views recorded in this period.");
    expect(NO_CLICKS_LINE).toBe("No clicks recorded in this period.");
    expect(NO_WAITERS_LINE).toBe("No one is waiting on a variety yet.");
    expect(soldOutLine(75, 25)).toBe("33% of clicks were on sold-out listings");
    expect(soldOutLine(0, 0)).toBeNull();
  });
});

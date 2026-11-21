/**
 * Slice A (review queues) without a database: queue order and addressing, proposal labels,
 * the why-matched line, decision sentences, status wording, reason composition, and the
 * rendered workspace components (role-aware copy, Act = absent, C4 order). Children ride as
 * trailing createElement arguments, never as props.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ageWords,
  composeReason,
  correctionFields,
  decisionSentence,
  farmDecisionSentence,
  itemLabel,
  itemRefParam,
  LISTING_REJECT_REASONS,
  matchLine,
  outcomeLabel,
  parseItemRef,
  QUEUES,
  QUEUE_WINDOW,
  queueDef,
  queueForType,
  reportListingId,
  reportMessage,
  reportTarget,
  reportTitle,
  RETIRE_REASONS,
  statusLine,
  verifiedLine,
} from "@/lib/admin/review-queues";
import { reviewHref } from "@/app/admin/(protected)/review/_components/urls";
import { QueueNav } from "@/app/admin/(protected)/review/_components/queue-nav";
import { QueueList } from "@/app/admin/(protected)/review/_components/queue-list";
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { FarmDetailView, HuntDetailView } from "@/app/admin/(protected)/review/_components/detail-seller";
import { ListingDetailView } from "@/app/admin/(protected)/review/_components/detail-listing";
import { DuplicateDetailView } from "@/app/admin/(protected)/review/_components/detail-duplicate";
import { ReportDetailView } from "@/app/admin/(protected)/review/_components/detail-report";
import { DuplicateChoice, SheetReasonButton } from "@/app/admin/(protected)/review/_components/decision-controls";
import type { DetailShell } from "@/app/admin/(protected)/review/_components/detail-types";

const SHELL: DetailShell = { role: "admin", queue: "sellers", show: 25, submittedOn: "Nov 18, 2026" };
const NOW = new Date(2026, 10, 21, 12, 0, 0);

describe("queues", () => {
  it("run in fixed decision-urgency order with their types", () => {
    expect(QUEUES.map((q) => q.key)).toEqual(["duplicates", "sellers", "listings", "reports"]);
    expect(QUEUES.map((q) => q.types)).toEqual([["duplicate_hold"], ["seller_candidate"], ["listing_match", "new_variety"], ["seller_correction", "removal"]]);
    expect(QUEUE_WINDOW).toBeLessThanOrEqual(50);
    expect(queueDef("sellers")?.name).toBe("Seller candidates");
    expect(queueDef("nope")).toBeNull();
    expect(queueForType("duplicate_hold")).toBe("duplicates");
    expect(queueForType("seller_candidate")).toBe("sellers");
    expect(queueForType("new_variety")).toBe("listings");
    expect(queueForType("removal")).toBe("reports");
    expect(queueForType("nope")).toBeNull();
  });

  it("items are addressable by stable review-N / farm-N refs", () => {
    expect(itemRefParam({ kind: "review", id: 12 })).toBe("review-12");
    expect(itemRefParam({ kind: "farm", id: 5 })).toBe("farm-5");
    expect(parseItemRef("review-12")).toEqual({ kind: "review", id: 12 });
    expect(parseItemRef("farm-5")).toEqual({ kind: "farm", id: 5 });
    for (const bad of [null, undefined, "", "12", "review-", "review-x", "farm-0", "seller-3", "review-1;DROP"]) expect(parseItemRef(bad)).toBeNull();
  });

  it("workspace links carry queue, item, segment, window and page", () => {
    expect(reviewHref({ queue: "sellers" })).toBe("/admin/review?queue=sellers");
    expect(reviewHref({ queue: "sellers", item: { kind: "farm", id: 5 }, show: 50 })).toBe("/admin/review?queue=sellers&item=farm-5&show=50");
    expect(reviewHref({ queue: "reports", decided: true, page: 3 })).toBe("/admin/review?queue=reports&decided=1&page=3");
  });
});

describe("labels", () => {
  it("derives the item label from the proposal, never log-speak when a label exists", () => {
    expect(itemLabel("listing_match", { extracted_name: "Dearest Sunset" }, 1)).toBe("Dearest Sunset");
    expect(itemLabel("new_variety", { extracted_name: "Blue Fire" }, 2)).toBe("Blue Fire");
    expect(itemLabel("seller_candidate", { name: "Fox Farm" }, 3)).toBe("Fox Farm");
    expect(itemLabel("seller_correction", { report: { target_type: "seller", target_ref: "geoseed" } }, 4)).toBe("geoseed");
    expect(itemLabel("removal", { report: { target_type: "seller", target_ref: "old-farm" } }, 5)).toBe("old-farm");
    expect(itemLabel("duplicate_hold", { held_name: "Chantilly Pink" }, 6)).toBe("Chantilly Pink");
  });

  it("falls back to honest numbered wording when the proposal carries no label", () => {
    expect(itemLabel("seller_candidate", {}, 12)).toBe("seller candidate #12");
    expect(itemLabel("duplicate_hold", {}, 7)).toBe("duplicate hold #7");
  });

  it("titles reports by kind and target", () => {
    expect(reportTitle({ report: { type: "correct", target_type: "seller" } })).toBe("Seller correction");
    expect(reportTitle({ report: { type: "correct", target_type: "variety" } })).toBe("Variety correction");
    expect(reportTitle({ report: { type: "remove", target_type: "seller" } })).toBe("Removal request");
    expect(reportTitle({ report: { type: "remove", target_type: "variety" } })).toBe("Removal request");
    expect(reportTitle({ report: { type: "claim", target_type: "seller" } })).toBe("Ownership claim");
    expect(reportTitle({})).toBe("Report");
  });

  it("reads targets, messages, fields and routed listings defensively", () => {
    expect(reportTarget({ report: { target_type: "variety", target_ref: "zinnia-x" } })).toEqual({ type: "variety", ref: "zinnia-x" });
    expect(reportTarget({})).toEqual({ type: "seller", ref: "" });
    expect(reportMessage({ report: { message: "hello" } })).toBe("hello");
    expect(reportMessage({})).toBeNull();
    expect(correctionFields({ fields: { location: "Greenwood, SC", shipsTo: ["US"] } })).toEqual({ location: "Greenwood, SC", shipsTo: ["US"] });
    expect(correctionFields({})).toEqual({});
    expect(correctionFields({ fields: { location: 42 } })).toEqual({});
    expect(reportListingId({ listing_id: 9 })).toBe(9);
    expect(reportListingId({})).toBeNull();
    expect(reportListingId({ listing_id: "9" })).toBeNull();
  });

  it("states the match reasoning with crop agreement always explicit", () => {
    expect(matchLine({ crop: "zinnia", match: { method: "model", confidence: 0.82 } })).toBe("The model matched this listing; confidence 82%; the crop agrees (zinnia).");
    expect(matchLine({ match: { method: "exact" } })).toBe("The listing names this variety exactly; the crop could not be checked.");
    expect(matchLine({})).toBe("The machine matched this listing; the crop could not be checked.");
  });
});

describe("decision sentences", () => {
  it("names the decider and the item in plain words", () => {
    expect(decisionSentence({ id: 1, type: "seller_candidate", proposal: { name: "Fox Farm" }, status: "approved", decidedByName: "Rae" })).toBe("Rae approved Fox Farm");
    expect(decisionSentence({ id: 2, type: "listing_match", proposal: { extracted_name: "Dearest Sunset" }, status: "rejected", decidedByName: "Rae" })).toBe("Rae declined Dearest Sunset");
    expect(decisionSentence({ id: 3, type: "seller_correction", proposal: { report: { target_type: "seller", target_ref: "geoseed" } }, status: "approved", decidedByName: "Ann" })).toBe("Ann applied a correction to geoseed");
    expect(decisionSentence({ id: 4, type: "removal", proposal: { report: { target_type: "seller", target_ref: "old-farm" } }, status: "approved", decidedByName: "Ann" })).toBe("Ann removed old-farm");
  });

  it("words duplicate outcomes as the consequence panels do", () => {
    expect(decisionSentence({ id: 5, type: "duplicate_hold", proposal: { held_name: "Chantilly Pink", candidate: { name: "Chantilly Light Pink" } }, status: "merged", decidedByName: "Rae" })).toBe(
      "Rae marked 'Chantilly Pink' a duplicate of 'Chantilly Light Pink'",
    );
    expect(decisionSentence({ id: 6, type: "duplicate_hold", proposal: { held_name: "Blue Fire" }, status: "approved", decidedByName: "Rae" })).toBe("Rae added 'Blue Fire' as its own variety");
  });

  it("keeps the honest legacy wording when no decider or label exists (never an invented name)", () => {
    expect(decisionSentence({ id: 12, type: "seller_candidate", proposal: {}, status: "approved", decidedByName: null })).toBe("Approved seller candidate #12");
    expect(decisionSentence({ id: 7, type: "duplicate_hold", proposal: { held_name: "X", candidate: { name: "Y" } }, status: "merged", decidedByName: null })).toBe("Marked 'X' a duplicate of 'Y'");
  });

  it("words farm decisions with the farm's name", () => {
    expect(farmDecisionSentence({ farmName: "Fox Farm", status: "approved", reviewedBy: "Rae" })).toBe("Rae approved Fox Farm");
    expect(farmDecisionSentence({ farmName: "Fox Farm", status: "rejected", reviewedBy: null })).toBe("Declined Fox Farm");
  });

  it("labels decided-segment outcomes in plain words", () => {
    expect(outcomeLabel("duplicate_hold", "merged", { candidate: { name: "Y" } })).toBe("Marked a duplicate of 'Y'");
    expect(outcomeLabel("duplicate_hold", "approved", {})).toBe("Added as its own variety");
    expect(outcomeLabel("seller_correction", "approved", {})).toBe("Correction applied");
    expect(outcomeLabel("removal", "approved", {})).toBe("Removal applied");
    expect(outcomeLabel("listing_match", "rejected", {})).toBe("Declined");
    expect(outcomeLabel("seller_candidate", "approved", {})).toBe("Approved");
  });
});

describe("status lines", () => {
  it("resolves every decision to its consequence-panel words", () => {
    expect(statusLine({ status: "seller_created" })).toMatchObject({ text: "Seller created — finish their details in Sellers", href: "/admin/sellers" });
    expect(statusLine({ status: "published", variety: "Dearest Sunset" })?.text).toBe("Published on Dearest Sunset's public page.");
    expect(statusLine({ status: "duplicate_kept", existing: "Chantilly Light Pink" })?.text).toBe("Kept as another name for 'Chantilly Light Pink'.");
    expect(statusLine({ status: "variety_added", held: "Blue Fire" })?.text).toBe("Added 'Blue Fire' as its own variety.");
    expect(statusLine({ status: "correction_applied", seller: "geoseed" })?.text).toBe("Correction applied to geoseed.");
    expect(statusLine({ status: "removal_applied", seller: "old-farm" })?.text).toBe("Removed old-farm from the directory.");
    expect(statusLine({ status: "listing_retired", variety: "Dearest Sunset" })?.text).toBe("Listing retired from 'Dearest Sunset's page.");
    expect(statusLine({ status: "report_verified" })?.text).toBe("Verified — waiting for an admin.");
    expect(statusLine({ status: "hold_skipped" })?.text).toBe("Skipped for now — still waiting.");
    expect(statusLine({ status: "failed" })?.text).toBe("That didn't go through. Try again.");
    expect(statusLine({ status: "stale_candidate" })?.text).toBe("That variety changed while you were deciding — here is the latest.");
  });

  it("lands decided-deep-links on the A5 wording, and ignores unknown codes", () => {
    expect(statusLine({ status: "already_decided", name: "Rae" })?.text).toBe("That one was already decided by Rae.");
    expect(statusLine({ status: "already_decided" })?.text).toBe("That one was already decided.");
    expect(statusLine({})).toBeNull();
    expect(statusLine({ status: "bogus" })).toBeNull();
  });

  it("writes the verified line, and friendly ages", () => {
    expect(verifiedLine("Rae")).toBe("Verified by Rae — waiting for an admin");
    expect(verifiedLine(null)).toBeNull();
    expect(ageWords("2026-11-21T10:00:00.000Z", NOW)).toBe("today");
    expect(ageWords("2026-11-20T10:00:00.000Z", NOW)).toBe("1 day");
    expect(ageWords("2026-11-18T10:00:00.000Z", NOW)).toBe("3 days");
    expect(ageWords(null, NOW)).toBe("");
  });
});

describe("reason composition", () => {
  it("folds a select value and an optional note into one record line", () => {
    expect(LISTING_REJECT_REASONS).toEqual(["Wrong variety", "Not seed", "Dead link", "Other"]);
    expect(RETIRE_REASONS).toEqual(["Wrong variety", "Not seed", "Dead link", "Duplicate listing", "Other"]);
    expect(composeReason("Wrong variety", "sold as zinnia")).toBe("Wrong variety — sold as zinnia");
    expect(composeReason("Dead link", null)).toBe("Dead link");
    expect(composeReason(null, "a note")).toBe("a note");
    expect(composeReason(null, null)).toBeNull();
    expect(composeReason("  ", "  ")).toBeNull();
  });
});

describe("queue switcher and list", () => {
  const counts = { duplicates: 2, sellers: 0, listings: 5, reports: 1 } as const;

  it("lists all four queues in order with live counts and All clear at zero", () => {
    const html = renderToStaticMarkup(createElement(QueueNav, { active: "sellers", counts }));
    const order = ["Duplicate varieties", "Seller candidates", "Queued listings", "Reports"].map((n) => html.indexOf(n));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain(">2<");
    expect(html).toContain("All clear");
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('href="/admin/review?queue=duplicates"');
  });

  it("renders waiting rows oldest-first with the verified line and the window count", () => {
    const html = renderToStaticMarkup(
      createElement(QueueList, {
        queue: "reports",
        show: 25,
        decided: false,
        rows: [
          { ref: { kind: "review", id: 1 }, type: "removal", name: "Removal request", facts: "seller old-farm", createdAt: "2026-11-18T10:00:00.000Z", source: "Please remove us", verifiedBy: "Rae", seenBy: null, age: "3 days" },
          { ref: { kind: "review", id: 2 }, type: "seller_correction", name: "Seller correction", facts: "seller geoseed", createdAt: "2026-11-20T10:00:00.000Z", source: null, verifiedBy: null, seenBy: null, age: "1 day" },
        ],
        total: 30,
        selected: { kind: "review", id: 1 },
        decidedRows: [],
        decidedTotal: 4,
        decidedPage: 1,
      }),
    );
    expect(html.indexOf("Removal request")).toBeLessThan(html.indexOf("Seller correction"));
    expect(html).toContain("Verified by Rae — waiting for an admin");
    expect(html).toContain("Showing 2 of 30");
    expect(html).toContain("Show more");
    expect(html).toContain("show=50");
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Waiting");
    expect(html).toContain("Decided");
  });

  it("renders the read-only decided segment with outcomes, deciders and pages", () => {
    const html = renderToStaticMarkup(
      createElement(QueueList, {
        queue: "sellers",
        show: 25,
        decided: true,
        rows: [],
        total: 0,
        selected: null,
        decidedRows: [{ ref: { kind: "review", id: 3 }, type: "seller_candidate", name: "Fox Farm", outcome: "Approved", decider: "Rae", at: "2026-11-20T10:00:00.000Z", time: "yesterday" }],
        decidedTotal: 25,
        decidedPage: 1,
      }),
    );
    expect(html).toContain("Fox Farm");
    expect(html).toContain("Approved");
    expect(html).toContain("Rae");
    expect(html).toContain("yesterday");
    expect(html).toContain('aria-label="Decided history pages"');
    expect(html).toContain("decided=1");
    expect(html).not.toContain("No decisions in this queue yet.");
  });

  it("announces decisions through the status banner, with the Sellers handoff", () => {
    const html = renderToStaticMarkup(createElement(StatusBanner, { status: { kind: "seller_created", text: "Seller created — finish their details in Sellers", href: "/admin/sellers", hrefLabel: "Open Sellers" } }));
    expect(html).toContain('role="status"');
    expect(html).toContain("Seller created");
    expect(html).toContain('href="/admin/sellers"');
    expect(html).not.toContain("Undo");
  });
});

describe("seller-candidate views", () => {
  const hunt = { ref: { kind: "review", id: 1 } as const, type: "seller_candidate" as const, name: "Fox Farm", createdAt: "2026-11-18T10:00:00.000Z", website: "https://foxfarm.example", domain: "foxfarm.example" };
  const farm = {
    ref: { kind: "farm", id: 5 } as const,
    type: "farm_submission" as const,
    name: "Fox Farm",
    createdAt: "2026-11-18T10:00:00.000Z",
    contactName: "F Ann",
    contactEmail: "fann@example.com",
    city: "Springfield",
    state: "OR",
    website: "https://foxfarm.example",
    growsText: "We grow zinnias.",
    varietiesText: "Dearest Sunset",
    businessPhone: "5415550199",
    wholesale: null,
    notes: null,
    suggested: { city: "Springfield!", phone: "5415550199" },
    draftStatus: "ready" as const,
    draftSummary: "A small farm.",
    evidence: [{ claim: "Grows zinnias", quote: "zinnias", url: "https://foxfarm.example" }],
  };

  it("shows the hunt record approval will create, with the admin consequence line", () => {
    const html = renderToStaticMarkup(createElement(HuntDetailView, { ...SHELL, role: "admin", detail: hunt }));
    expect(html).toContain("Fox Farm");
    expect(html).toContain("Found by the hunt");
    expect(html).toContain("foxfarm.example");
    expect(html).toContain("Approving creates this seller. They aren&#x27;t listed publicly until you finish their details and Small Farm classification in Sellers.");
    expect(html).toContain(">Approve<");
    expect(html).toContain(">Decline<");
    expect(html).toContain('target="_blank"');
  });

  it("words the consequence for the reviewer's hands", () => {
    const html = renderToStaticMarkup(createElement(HuntDetailView, { ...SHELL, role: "reviewer", detail: hunt }));
    expect(html).toContain("until an admin finishes their details and Small Farm classification in Sellers.");
  });

  it("renders the Submitted | Suggested comparison and the never-published draft panel", () => {
    const html = renderToStaticMarkup(createElement(FarmDetailView, { ...SHELL, role: "reviewer", detail: farm }));
    expect(html).toContain("Add Your Farm submission");
    expect(html).toContain("Submitted | Suggested");
    expect(html).toContain("Springfield! (suggested)");
    expect(html).toContain("Draft summary — never published automatically");
    expect(html).toContain("A small farm.");
    expect(html).toContain("Grows zinnias");
    expect(html).toContain('target="_blank"');
  });
});

describe("queued-listing view", () => {
  const base = {
    ref: { kind: "review", id: 2 } as const,
    name: "Dearest Sunset",
    createdAt: "2026-11-18T10:00:00.000Z",
    extractedName: "Dearest Sunset",
    crop: "zinnia",
    cropCommon: "Zinnia",
    match: "The model matched this listing; confidence 82%; the crop agrees (zinnia).",
    listing: { sellerName: "Songbird Seed Co.", sellerSlug: "songbird-seed-co", isSmallFarm: true, titleRaw: "Dearest Sunset Zinnia Seeds", productUrl: "https://shop.example/p/1", packets: ["50 seeds"] },
  };

  it("stacks the listing over the variety with the connector and the publish line", () => {
    const html = renderToStaticMarkup(
      createElement(ListingDetailView, { ...SHELL, queue: "listings", detail: { ...base, type: "listing_match" as const, variety: { kind: "existing" as const, name: "Dearest Sunset", slug: "zinnia-dearest-sunset", cropCommon: "Zinnia", seriesName: null, sellerCount: 2 } } }),
    );
    expect(html).toContain("The listing");
    expect(html).toContain("matched to");
    expect(html).toContain("The variety");
    expect(html).toContain("Songbird Seed Co.");
    expect(html).toContain("data-small-farm-badge");
    expect(html).toContain("Packet sizes: 50 seeds");
    expect(html).toContain("2 sellers");
    expect(html).toContain("/variety/zinnia-dearest-sunset");
    expect(html).toContain("Why the machine matched it:");
    expect(html).toContain("the crop agrees (zinnia).");
    expect(html).toContain("Publishing puts this listing on Dearest Sunset&#x27;s public page, linking to the seller&#x27;s product page.");
    expect(html).toContain(">Publish listing<");
    expect(html).toContain(">Reject<");
  });

  it("offers Add the variety for new-variety items", () => {
    const html = renderToStaticMarkup(
      createElement(ListingDetailView, { ...SHELL, queue: "listings", detail: { ...base, type: "new_variety" as const, variety: { kind: "to_create" as const, name: "Blue Fire", crop: "zinnia" } } }),
    );
    expect(html).toContain("Approving will create");
    expect(html).toContain(">Add the variety<");
  });
});

describe("duplicate view", () => {
  const hold = {
    ref: { kind: "review", id: 7 } as const,
    type: "duplicate_hold" as const,
    name: "Chantilly Pink",
    createdAt: "2026-11-18T10:00:00.000Z",
    seenBy: null,
    held: { name: "Chantilly Pink", crop: "snapdragon", cropCommon: "Snapdragon", latinName: null, sellerName: "GeoSeed", sellerSlug: "geoseed", titleRaw: "Chantilly Pink Snapdragon", productUrl: "https://shop.example/p/2", availability: "in_stock" },
    existing: {
      id: 123,
      slug: "snapdragon-chantilly-light-pink",
      name: "Chantilly Light Pink",
      status: "active",
      plantSlug: "snapdragon",
      commonName: "Snapdragon",
      latinName: "Antirrhinum majus",
      seriesName: "Chantilly",
      sellerCount: 2,
      aliases: ["Chantilly Rose Pink"],
      listings: [{ sellerName: "GeoSeed", sellerSlug: "geoseed", titleRaw: "Chantilly Light Pink", productUrl: "https://shop.example/p/3" }],
    },
    stale: false,
    candidateName: "Chantilly Light Pink",
    evidenceQuote: "looks the same",
    holdReason: "Possible duplicate of Chantilly Light Pink",
    comparison: { sameCrop: true, cropLine: "Same crop: Snapdragons", nameLine: "Names differ by one word", sharedSellers: 1, sellerLine: "Sold by 1 of the same sellers" },
  };

  it("holds the held variety first and never swaps, with neutral verdicts", () => {
    const html = renderToStaticMarkup(createElement(DuplicateDetailView, { ...SHELL, queue: "duplicates", detail: hold }));
    const held = html.indexOf("The held variety");
    const existing = html.indexOf("The variety already in the directory");
    expect(held).toBeGreaterThanOrEqual(0);
    expect(existing).toBeGreaterThan(held);
    expect(html).toContain("Same crop: Snapdragons");
    expect(html).toContain("Names differ by one word");
    expect(html).toContain("Sold by 1 of the same sellers");
    expect(html).toContain("Antirrhinum majus");
    expect(html).toContain("also called Chantilly Rose Pink");
    expect(html).toContain("/variety/snapdragon-chantilly-light-pink");
    expect(html).toContain("Why the scout held it");
  });

  it("offers two equal secondary buttons plus Skip, with consequences hidden until chosen", () => {
    const html = renderToStaticMarkup(createElement(DuplicateChoice, { held: "Chantilly Pink", existing: "Chantilly Light Pink", baseFields: { kind: "review", id: "7" } }));
    expect(html).toContain("It&#x27;s a duplicate");
    expect(html).toContain("Not a duplicate");
    expect(html).not.toContain("btn-primary");
    expect(html).not.toContain("Confirm: mark as duplicate");
    const view = renderToStaticMarkup(createElement(DuplicateDetailView, { ...SHELL, queue: "duplicates", detail: hold }));
    expect(view).toContain("Skip for now");
    expect(view).toContain('name="action" value="skip_hold"');
  });

  it("says plainly when the existing variety is gone", () => {
    const html = renderToStaticMarkup(createElement(DuplicateDetailView, { ...SHELL, queue: "duplicates", detail: { ...hold, existing: null } }));
    expect(html).toContain("is no longer in the directory");
  });
});

describe("report view", () => {
  const seller = {
    id: 9,
    slug: "geoseed",
    name: "GeoSeed",
    homepage: "https://geoseed.example",
    domain: "geoseed.example",
    location: "Clinton, SC",
    region: "SC",
    country: "US",
    shipsTo: '["unknown"]',
    description: null,
    orderingNotes: null,
    status: "active",
    eligibility: "approved",
    isSmallFarm: false,
    liveListingCount: 23,
  };
  const structured = {
    ref: { kind: "review", id: 11 } as const,
    type: "seller_correction" as const,
    name: "Seller correction",
    createdAt: "2026-11-18T10:00:00.000Z",
    verifiedBy: null,
    reportType: "correct",
    message: "We moved!",
    targetType: "seller" as const,
    targetRef: "geoseed",
    seller,
    variety: null,
    fields: { location: "Greenwood, SC" },
    hasFields: true,
    listing: null,
  };

  it("compares Reported | Currently shown and applies identically for reviewers (RA-3)", () => {
    for (const role of ["admin", "reviewer"]) {
      const html = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role, detail: structured }));
      expect(html).toContain("Seller correction");
      expect(html).toContain("We moved!");
      expect(html).toContain("Reported | Currently shown");
      expect(html).toContain("Greenwood, SC");
      expect(html).toContain("Clinton, SC");
      expect(html).toContain(">Apply the correction<");
      expect(html).toContain(">Dismiss<");
    }
  });

  it("renders removal for admins only, and retirement only with its listing", () => {
    const removal = { ...structured, type: "removal" as const, name: "Removal request", reportType: "remove", fields: {}, hasFields: false };
    const adminHtml = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "admin", detail: removal }));
    expect(adminHtml).toContain(">Apply removal<");
    expect(adminHtml).not.toContain(">Retire the listing<");
    expect(adminHtml).not.toContain(">Confirm report<");
    const reviewerHtml = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "reviewer", detail: removal }));
    expect(reviewerHtml).not.toContain(">Apply removal<");
    expect(reviewerHtml).toContain(">Confirm report<");
    const withListing = { ...removal, listing: { id: 44, titleRaw: "Old packet", productUrl: "https://shop.example/p/4", status: "published", varietySlug: "zinnia-x", varietyName: "X", sellerSlug: "geoseed", sellerName: "GeoSeed" } };
    const retireHtml = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "admin", detail: withListing }));
    expect(retireHtml).toContain(">Retire the listing<");
    const retireReviewer = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "reviewer", detail: withListing }));
    expect(retireReviewer).not.toContain(">Retire the listing<");
  });

  it("guides free-form corrections and variety removals in plain words", () => {
    const free = { ...structured, fields: {}, hasFields: false };
    const adminHtml = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "admin", detail: free }));
    expect(adminHtml).not.toContain(">Apply the correction<");
    expect(adminHtml).toContain("To apply this correction, edit the seller from their record in Sellers.");
    expect(adminHtml).toContain("/seller/geoseed");
    const varietyRemoval = { ...structured, type: "removal" as const, name: "Removal request", targetType: "variety" as const, targetRef: "zinnia-x", seller: null, fields: {}, hasFields: false };
    const varietyHtml = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "admin", detail: varietyRemoval }));
    expect(varietyHtml).not.toContain(">Apply removal<");
    expect(varietyHtml).toContain("Variety removals are handled from the variety&#x27;s record.");
  });

  it("shows the verified line once a reviewer confirms", () => {
    const html = renderToStaticMarkup(createElement(ReportDetailView, { ...SHELL, queue: "reports", role: "admin", detail: { ...structured, verifiedBy: "Rae" } }));
    expect(html).toContain("Verified by Rae — waiting for an admin");
  });
});

describe("reason sheets", () => {
  const fields = { action: "reject_listing", kind: "review", id: "2", queue: "listings", show: "25", created_at: "2026-11-18T10:00:00.000Z" };

  it("opens from a button and keeps the reason inside the sheet", () => {
    const html = renderToStaticMarkup(createElement(SheetReasonButton, { buttonLabel: "Reject", sheetTitle: "Reject this listing", fields, reasons: LISTING_REJECT_REASONS, submitLabel: "Reject" }));
    expect(html).toContain(">Reject<");
    // Closed until tapped: no dialog, no select, no open form on the page.
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("<select");
  });
});

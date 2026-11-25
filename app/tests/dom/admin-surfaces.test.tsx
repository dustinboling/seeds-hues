// @vitest-environment jsdom
/**
 * Slice 7 admin surfaces: role rendering (Act = absent — items outside
 * the role are not rendered at all), the iPad-first layout (master–detail
 * at 1024×768 and 1180×820 with no phone-layout collapse; 1180px is the
 * iPad band, desktop starts at 1181px), the hub dashboard, and the
 * statistics data product incl. the dark Visitors card.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminShell } from "../../src/components/admin/AdminShell";
import { viewportBand } from "../../src/components/admin/viewport";
import { NoAccess } from "../../src/components/admin/NoAccess";
import { HubView } from "../../src/components/admin/HubView";
import { ReviewView } from "../../src/components/admin/ReviewView";
import { SellersView } from "../../src/components/admin/SellersView";
import { VarietiesView } from "../../src/components/admin/VarietiesView";
import { ListingsView } from "../../src/components/admin/ListingsView";
import { AccountsView } from "../../src/components/admin/AccountsView";
import { StatisticsView } from "../../src/components/admin/StatisticsView";

function setViewport(width: number, height: number): void {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}

const ADMIN = { name: "Dustin", email: "dustin@hues.flowers", role: "admin" };
const REVIEWER = { name: "Ruth Reviewer", email: "ruth@example.com", role: "reviewer" };

describe("viewport bands (v2 §4: 1180px is iPad, desktop starts 1181px)", () => {
  it("classifies widths exactly", () => {
    expect(viewportBand(390)).toBe("phone");
    expect(viewportBand(743)).toBe("phone");
    expect(viewportBand(744)).toBe("ipad");
    expect(viewportBand(1024)).toBe("ipad");
    expect(viewportBand(1180)).toBe("ipad");
    expect(viewportBand(1181)).toBe("desktop");
    expect(viewportBand(1440)).toBe("desktop");
  });
});

describe("AdminShell navigation by role + viewport", () => {
  it("iPad 1024×768: the rail shows every admin section with the review badge", () => {
    setViewport(1024, 768);
    render(
      <AdminShell viewer={ADMIN} section="review" reviewTotal={5}>
        <p>pane</p>
      </AdminShell>,
    );
    const rail = screen.getByRole("navigation", { name: "Admin sections" });
    expect(rail.textContent).toContain("Seed Directory admin");
    for (const label of ["Home", "Review", "Sellers", "Listings", "Varieties", "Statistics", "Accounts"]) {
      expect(rail.textContent).toContain(label);
    }
    expect(screen.getByRole("link", { name: "Review, 5 waiting" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Stats" })).toBeNull();
    expect(screen.getByText("Dustin")).not.toBeNull();
    expect(screen.getByText("Admin")).not.toBeNull();
  });

  it("iPad 1180×820: still the rail (the iPad band's upper edge)", () => {
    setViewport(1180, 820);
    render(
      <AdminShell viewer={ADMIN} section="home" reviewTotal={0}>
        <p>pane</p>
      </AdminShell>,
    );
    expect(screen.getByRole("navigation", { name: "Admin sections" }).textContent).toContain("Statistics");
  });

  it("phone 390×844: the five-tab bar, no rail", () => {
    setViewport(390, 844);
    render(
      <AdminShell viewer={ADMIN} section="sellers" reviewTotal={5}>
        <p>pane</p>
      </AdminShell>,
    );
    const tabs = screen.getByRole("navigation", { name: "Admin sections" });
    for (const label of ["Home", "Review", "Sellers", "Stats", "More"]) {
      expect(tabs.textContent).toContain(label);
    }
    expect(tabs.textContent).not.toContain("Seed Directory admin");
  });

  it("reviewers never see Accounts (Act = absent, both shells)", () => {
    setViewport(1024, 768);
    const { unmount } = render(
      <AdminShell viewer={REVIEWER} section="home" reviewTotal={5}>
        <p>pane</p>
      </AdminShell>,
    );
    expect(screen.getByRole("navigation", { name: "Admin sections" }).textContent).not.toContain("Accounts");
    expect(screen.getByText("Reviewer")).not.toBeNull();
    unmount();
    setViewport(390, 844);
    render(
      <AdminShell viewer={REVIEWER} section="home" reviewTotal={5}>
        <p>pane</p>
      </AdminShell>,
    );
    expect(screen.getByRole("navigation", { name: "Admin sections" }).textContent).not.toContain("Accounts");
  });

  it("sign-out is a native POST to the sign-out handler", () => {
    setViewport(1024, 768);
    render(
      <AdminShell viewer={ADMIN} section="home" reviewTotal={0}>
        <p>pane</p>
      </AdminShell>,
    );
    const button = screen.getByRole("button", { name: "Sign out of admin" });
    const form = button.closest("form")!;
    expect(form.getAttribute("method")).toBe("post");
    expect(form.getAttribute("action")).toBe("/admin/sign-in/sign-out");
  });
});

describe("master–detail at iPad widths (no phone-layout collapse)", () => {
  const rows = [{ ref: { kind: "review", id: 101 }, type: "listing_match", name: "Lonely Bloom", facts: "Blue Ridge Seeds", createdAt: "2026-11-20T09:00:00.000Z", source: null }];

  it("iPad review: the queue list AND the decision pane render together", () => {
    setViewport(1024, 768);
    render(<ReviewView queue="listings" rows={rows} total={1} selected={{ kind: "review", id: 101 }} detail={{ type: "listing_match", name: "Lonely Bloom", extractedName: "Lonely Bloom" }} role="admin" />);
    // Both the queue row and the decision pane's title name the item.
    expect(screen.getAllByText("Lonely Bloom").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Publish listing" })).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Queues" })).not.toBeNull();
  });

  it("phone review without a selection: the list renders, the decision pane does not", () => {
    setViewport(390, 844);
    render(<ReviewView queue="listings" rows={rows} total={1} selected={null} detail={null} role="admin" />);
    expect(screen.getByRole("navigation", { name: "Queues" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Publish listing" })).toBeNull();
  });

  it("iPad sellers: the seller list AND the detail render together", () => {
    setViewport(1180, 820);
    render(
      <SellersView
        rows={[{ slug: "geoseed", name: "GeoSeed", location: "Clinton, SC", region: "SC", isSmallFarm: false, status: "active", eligibility: "candidate", listings: 0 }]}
        total={1}
        selected="geoseed"
        detail={{ slug: "geoseed", name: "GeoSeed", type: "retail", platform: "woocommerce", homepage: null, contactEmail: null, csPhone: null, csEmail: null, location: "Clinton, SC", locations: [], region: "SC", country: "US", shipsTo: "unknown", description: null, orderingNotes: null, status: "active", eligibility: "candidate", listingPolicy: "standard", isSmallFarm: false, liveListingCount: 0, listings: [], notes: [] }}
        role="admin"
      />,
    );
    expect(screen.getByPlaceholderText("Seller name")).not.toBeNull();
    expect(screen.getByText("Information")).not.toBeNull();
    expect(screen.getByText("Internal notes — never shown on the public site")).not.toBeNull();
  });
});

describe("role rendering inside the sections (Act = absent)", () => {
  const sellerDetail = {
    slug: "blue-ridge-seeds", name: "Blue Ridge Seeds", type: "retail", platform: "shopify", homepage: "https://blueridgeseeds.example.com",
    contactEmail: "hello@blueridgeseeds.example.com", csPhone: "(503) 555-0114", csEmail: "help@blueridgeseeds.example.com",
    location: "Portland, OR", locations: [{ kind: "physical", label: "Portland, OR", primary: true }], region: "OR", country: "US",
    shipsTo: "US", description: "A family farm.", orderingNotes: null, status: "active", eligibility: "approved", listingPolicy: "standard",
    isSmallFarm: true, liveListingCount: 1, listings: [], notes: [{ id: 1, authorName: "Dustin", authorRole: "admin", body: "NOTE-BLUERIDGE-7A", createdAt: "2026-11-20T14:14:00.000Z" }],
  };
  const sellerRows = [{ slug: "blue-ridge-seeds", name: "Blue Ridge Seeds", location: "Portland, OR", region: "OR", isSmallFarm: true, status: "active", eligibility: "approved", listings: 1 }];

  it("reviewer seller detail: identical layout, actions absent, notes shared", () => {
    setViewport(1024, 768);
    render(<SellersView rows={sellerRows} total={1} selected="blue-ridge-seeds" detail={sellerDetail} role="reviewer" />);
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Classify/ })).toBeNull();
    expect(screen.queryByText("Danger zone")).toBeNull();
    expect(screen.getByRole("button", { name: "Add note" })).not.toBeNull();
    expect(screen.getByText(/NOTE-BLUERIDGE-7A/)).not.toBeNull();
  });

  it("admin seller detail: edit + classify + danger zone render", () => {
    setViewport(1024, 768);
    render(<SellersView rows={sellerRows} total={1} selected="blue-ridge-seeds" detail={sellerDetail} role="admin" />);
    expect(screen.getByRole("button", { name: "Edit" })).not.toBeNull();
    expect(screen.getByText("Danger zone")).not.toBeNull();
  });

  it("reviewer variety detail: no remove control; admin sees the live-count block line", () => {
    setViewport(1024, 768);
    const detail = { slug: "sweet-pea-kings-ransom", name: "King's Ransom", crop: "sweet-pea", cropCommon: "Sweet Pea", liveListingCount: 3, listingCounts: [{ word: "Active", n: 3 }], listingTotal: 3, waiters: 4, aliases: [{ alias: "Ransom", source: "manual", decidedByName: null, createdAt: null }] };
    const rows = [{ slug: "sweet-pea-kings-ransom", name: "King's Ransom", crop: "sweet-pea", cropCommon: "Sweet Pea", sellers: 1, aliases: 1, matchedAlias: null }];
    const { unmount } = render(<VarietiesView rows={rows} total={1} selected="sweet-pea-kings-ransom" detail={detail} role="reviewer" />);
    expect(screen.queryByRole("button", { name: /Remove variety/ })).toBeNull();
    unmount();
    render(<VarietiesView rows={rows} total={1} selected="sweet-pea-kings-ransom" detail={detail} role="admin" />);
    expect(screen.getByText("This variety has 3 live listings. Retire them before removing the variety.")).not.toBeNull();
  });

  it("reviewer listing detail: no retire control; both roles read the history", () => {
    setViewport(1024, 768);
    const detail = { id: 501, title: "Trial packet", varietyName: "King's Ransom", varietySlug: "sweet-pea-kings-ransom", sellerName: "Blue Ridge Seeds", sellerSlug: "blue-ridge-seeds", productUrl: "https://shop.example.com/x", status: "active", packets: [{ label: "10 seeds", seedCount: 10 }], lastCheckedAt: "2026-11-20T08:00:00.000Z", history: [{ event: "first_seen", at: "2026-09-01T00:00:00.000Z", actor: null, reason: null, words: "Published" }] };
    const rows = [{ id: 501, title: "Trial packet", varietyName: "King's Ransom", varietySlug: "sweet-pea-kings-ransom", sellerName: "Blue Ridge Seeds", sellerSlug: "blue-ridge-seeds", status: "active", lastCheckedAt: "2026-11-20T08:00:00.000Z" }];
    const { unmount } = render(<ListingsView rows={rows} total={1} selected={501} detail={detail} role="reviewer" />);
    expect(screen.queryByRole("button", { name: /Retire/ })).toBeNull();
    expect(screen.getByText(/Published/)).not.toBeNull();
    unmount();
    render(<ListingsView rows={rows} total={1} selected={501} detail={detail} role="admin" />);
    expect(screen.getByRole("button", { name: "Retire listing" })).not.toBeNull();
  });

  it("reviewer accounts: the reviewer-accounts landing, never data", () => {
    setViewport(1024, 768);
    render(<AccountsView rows={[]} total={0} selected={null} detail={null} role="reviewer" />);
    expect(screen.getByText("Account settings")).not.toBeNull();
    expect(screen.getByText(/Your reviewer role doesn’t include account settings/)).not.toBeNull();
  });

  it("duplicate holds: BOTH roles get the two equal-weight decision buttons", () => {
    setViewport(1024, 768);
    const detail = { type: "duplicate_hold", name: "King's Ransom Select", held: { name: "King's Ransom Select", cropCommon: "Sweet Pea", sellerName: "Blue Ridge Seeds" }, existing: { name: "King's Ransom", slug: "sweet-pea-kings-ransom" } };
    const rows = [{ ref: { kind: "review", id: 103 }, type: "duplicate_hold", name: "King's Ransom Select", facts: "Looks like 'King's Ransom'", createdAt: "2026-11-22T11:00:00.000Z", source: "From the scout" }];
    for (const role of ["admin", "reviewer"]) {
      const { unmount } = render(<ReviewView queue="duplicates" rows={rows} total={1} selected={{ kind: "review", id: 103 }} detail={detail} role={role} />);
      expect(screen.getByRole("button", { name: "It's a duplicate" })).not.toBeNull();
      expect(screen.getByRole("button", { name: "Not a duplicate" })).not.toBeNull();
      unmount();
    }
  });
});

describe("NoAccess landings (no data of any kind)", () => {
  it("no-role names the account and offers both exits", () => {
    render(<NoAccess variant="no-role" name="Willa Gardener" email="willa@example.com" />);
    expect(screen.getByText("This is the admin section")).not.toBeNull();
    expect(screen.getByText(/Willa Gardener \(willa@example.com\)/)).not.toBeNull();
    expect(screen.getByRole("link", { name: "Go to the Seed Directory" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Sign in with a different email" })).not.toBeNull();
  });
});

describe("hub dashboard", () => {
  const cards = [
    { key: "duplicates", name: "Duplicate varieties", description: "Possible duplicate varieties held for a decision", count: 1, oldest: "2026-11-22T11:00:00.000Z", href: "/admin/review?queue=duplicates" },
    { key: "sellers", name: "Seller candidates", description: "Seller candidates from the hunt and Add Your Farm", count: 0, oldest: null, href: "/admin/review?queue=sellers" },
    { key: "listings", name: "Queued listings", description: "Shop listings waiting to join a variety page", count: 1, oldest: "2026-11-20T09:00:00.000Z", href: "/admin/review?queue=listings" },
    { key: "reports", name: "Reports", description: "Visitor reports waiting for a decision", count: 3, oldest: "2026-11-21T10:00:00.000Z", href: "/admin/review?queue=reports" },
  ];

  it("renders queue cards with counts, most wanted, and recent decisions", () => {
    render(
      <HubView
        cards={cards}
        totalWaiting={5}
        decisions={[{ text: "Dustin approved Lonely Bloom", at: "2026-11-24T10:00:00.000Z" }]}
        wanted={[{ slug: "cosmos-lonely-bloom", name: "Lonely Bloom", waiters: 7 }]}
        snapshot={{ cards: [] }}
      />,
    );
    expect(screen.getByText("Needs a decision")).not.toBeNull();
    expect(screen.getByText("Duplicate varieties")).not.toBeNull();
    expect(screen.getByText("Most wanted")).not.toBeNull();
    expect(screen.getAllByText(/Lonely Bloom/).length).toBeGreaterThan(0);
    expect(screen.getByText(/7 waiting/)).not.toBeNull();
    expect(screen.getByText("Recent decisions")).not.toBeNull();
    expect(screen.getByText(/Dustin approved Lonely Bloom/)).not.toBeNull();
  });

  it("the all-clear zero state when nothing waits", () => {
    render(<HubView cards={cards.map((c) => ({ ...c, count: 0, oldest: null }))} totalWaiting={0} decisions={[]} wanted={[]} snapshot={{ cards: [] }} />);
    expect(screen.getByText("Nothing waiting. The directory is up to date.")).not.toBeNull();
    expect(screen.getByText("No one is waiting on a variety yet.")).not.toBeNull();
    expect(screen.getByText("Decisions your team makes will appear here.")).not.toBeNull();
  });

  it("the snapshot Visitors card renders dark (pinned line, no number)", () => {
    render(
      <HubView
        cards={cards}
        totalWaiting={5}
        decisions={[]}
        wanted={[]}
        snapshot={{ cards: [{ key: "visitors", label: "Visitors", href: "/admin/statistics", caption: "Last 7 days", total: null, delta: null, trend: null, thinLine: null, noData: "Not connected yet — visitor counts come from Cloudflare Web Analytics.", error: false }] }}
      />,
    );
    const card = screen.getByText("Not connected yet — visitor counts come from Cloudflare Web Analytics.").closest("section,div")!;
    expect(card.textContent).not.toMatch(/\d{2,}/);
  });
});

describe("statistics data product", () => {
  it("the Visitors card renders v2's shape with no number", () => {
    render(
      <StatisticsView
        range="7d"
        signal="views"
        show={10}
        period={{ words: "Nov 17 – Nov 23, 2026", caption: "Last 7 days · Nov 17 – Nov 23, 2026" }}
        cards={[{ key: "visitors", label: "Visitors", href: "/admin/statistics", caption: "Last 7 days", total: null, delta: null, trend: null, thinLine: null, noData: "Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.", error: false }]}
        popularity={{ signal: "views", title: "Most viewed varieties", valueLabel: "Views", rows: [], shown: 0, total: 0, thin: false, thinLine: null, emptyLine: "No views recorded in this period.", soldOutLine: null, caption: "Last 7 days", error: false }}
      />,
    );
    expect(screen.getByText(/It isn’t connected to the directory yet/)).not.toBeNull();
  });

  it("popularity tables render ranks in order with movement", () => {
    render(
      <StatisticsView
        range="7d"
        signal="views"
        show={10}
        period={{ words: "Nov 17 – Nov 23, 2026", caption: "Last 7 days · Nov 17 – Nov 23, 2026" }}
        cards={[]}
        popularity={{
          signal: "views", title: "Most viewed varieties", valueLabel: "Views",
          rows: [
            { rank: 1, slug: "cosmos-candy-stripe", name: "Candy Stripe", crop: "Cosmos", value: 120, movement: { kind: "up", text: "▲ 1" } },
            { rank: 2, slug: "sweet-pea-kings-ransom", name: "King's Ransom", crop: "Sweet Pea", value: 90, movement: { kind: "down", text: "▼ 1" } },
          ],
          shown: 2, total: 2, thin: false, thinLine: null, emptyLine: "No views recorded in this period.", soldOutLine: null, caption: "Last 7 days", error: false,
        }}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(rows[1]!.textContent).toContain("Candy Stripe");
    expect(rows[1]!.textContent).toContain("▲ 1");
    expect(rows[2]!.textContent).toContain("King's Ransom");
  });

  it("the waitlist table states its range independence", () => {
    render(
      <StatisticsView
        range="30d"
        signal="waitlist"
        show={10}
        period={{ words: "Oct 25 – Nov 23, 2026", caption: "Last 30 days" }}
        cards={[]}
        popularity={{ signal: "waitlist", rows: [{ rank: 1, slug: "cosmos-lonely-bloom", name: "Lonely Bloom", crop: "Cosmos", waiters: 7, verified: 5, sellers: 0 }], shown: 1, total: 1, caption: "The current waiting list — it doesn’t change with the date range.", error: false }}
      />,
    );
    expect(screen.getByText("The current waiting list — it doesn’t change with the date range.")).not.toBeNull();
  });
});

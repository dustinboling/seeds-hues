// @vitest-environment jsdom
/**
 * Desktop header takeover (Item 5.3): at the lg tier the visible nav carries all five
 * destinations (Add Your Farm appended last, lg-only) with current-page state, and the
 * hamburger retires by CSS (`lg:hidden` on its wrapper). Below lg nothing changes: the
 * four-link nav, the account icon, and the fully working menu are exactly as before.
 *
 * Expected values derive from the header's own source (HEADER_NAV) plus one explicit
 * contract list each for the desktop nav and the menu panel; counts always derive from
 * those lists' lengths, never from hardcoded numbers.
 */
import { createElement, type ReactNode, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("next/link", () => ({
  // Anchor passthrough; forwards ref so the menu's focus management works as in production.
  default: ({ href, children, ref, ...rest }: { href: string; children: ReactNode; ref?: Ref<HTMLAnchorElement>; [key: string]: unknown }) =>
    createElement("a", { href, ref, ...(rest as Record<string, unknown>) }, children),
}));

import { SiteHeader } from "@/components/layout/SiteHeader";
import { HEADER_NAV } from "@/components/layout/HeaderNav";

afterEach(() => {
  cleanup();
  nav.pathname = "/";
});

/** Strict narrowing: throw when a query misses instead of casting a nullable away. */
function need<T>(el: T | null, what: string): T {
  if (el === null || el === undefined) throw new Error(`header test: missing ${what}`);
  return el;
}

/** The §3 contract, stated once: the five desktop destinations in display order. */
const EXPECTED_NAV = [
  { href: "/crop", label: "Crops" },
  { href: "/variety", label: "Varieties" },
  { href: "/seller", label: "Sellers" },
  { href: "/search", label: "Search" },
  { href: "/add-your-farm", label: "Add Your Farm" },
];

/** The unchanged menu-panel contract, stated once: all seven destinations in order. */
const EXPECTED_MENU_LABELS = ["Crops", "Varieties", "Sellers", "Search", "Add Your Farm", "About", "My Account"];

function mainNavLinks(): HTMLAnchorElement[] {
  render(<SiteHeader />);
  const navEl = screen.getByRole("navigation", { name: "Main" });
  return within(navEl).getAllByRole("link") as HTMLAnchorElement[];
}

function currentLinks(): HTMLAnchorElement[] {
  return screen.getAllByRole("link", { current: "page" }) as HTMLAnchorElement[];
}

describe("desktop nav contract", () => {
  it("HEADER_NAV is the five §3 destinations in display order", () => {
    expect(HEADER_NAV).toEqual(EXPECTED_NAV);
  });

  it("the Main nav renders every HEADER_NAV entry in order, as plain links", () => {
    const links = mainNavLinks();
    expect(links.map((l) => l.getAttribute("href"))).toEqual(HEADER_NAV.map((n) => n.href));
    expect(links.map((l) => l.textContent)).toEqual(HEADER_NAV.map((n) => n.label));
    for (const link of links) {
      // Plain nav link in the existing class treatment — no pill/button classes.
      // §6 lever 1 narrows the padding at the takeover tier only (px-3 kept below lg).
      expect(link.className).toContain("px-3");
      expect(link.className).toContain("lg:px-2");
      expect(link.className).not.toMatch(/rounded-full|bg-leaf(?!-50)|text-white/);
    }
    // Uniform treatment: with no section current, all five links share one class string.
    expect(new Set(links.map((l) => l.className)).size).toBe(1);
  });

  it("only the last item (Add Your Farm) is takeover-tier-only", () => {
    const links = mainNavLinks();
    expect(links).toHaveLength(EXPECTED_NAV.length);
    for (const [i, link] of links.entries()) {
      const item = need(link.closest("li"), `nav item ${i}`);
      const last = i === EXPECTED_NAV.length - 1;
      expect(link.getAttribute("href")).toBe(EXPECTED_NAV[i]!.href);
      expect(item.classList.contains("hidden")).toBe(last);
      expect(item.classList.contains("lg:block")).toBe(last);
    }
  });
});

describe("current-page state in the visible nav", () => {
  it.each(HEADER_NAV.map((n) => ({ pathname: n.href, href: n.href })))("exact $pathname marks only $href current", ({ pathname, href }) => {
    nav.pathname = pathname;
    mainNavLinks();
    const current = currentLinks();
    expect(current).toHaveLength(1);
    expect(current[0]!.getAttribute("href")).toBe(href);
  });

  it.each(HEADER_NAV.map((n) => ({ pathname: `${n.href}/evergreen`, href: n.href })))(
    "nested $pathname marks only $href current (prefix rule)",
    ({ pathname, href }) => {
      nav.pathname = pathname;
      mainNavLinks();
      const current = currentLinks();
      expect(current).toHaveLength(1);
      expect(current[0]!.getAttribute("href")).toBe(href);
    },
  );

  it("home (/) marks nothing current", () => {
    nav.pathname = "/";
    mainNavLinks();
    expect(screen.queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });

  it("current state is semibold + leaf, never color alone; others keep the base treatment", () => {
    nav.pathname = `${HEADER_NAV[1]!.href}/katz`;
    const links = mainNavLinks();
    for (const link of links) {
      const isCurrent = link.getAttribute("href") === HEADER_NAV[1]!.href;
      expect(link.getAttribute("aria-current")).toBe(isCurrent ? "page" : null);
      // Weight changes with color, so the state is never carried by color alone.
      expect(link.classList.contains("font-semibold")).toBe(isCurrent);
      expect(link.classList.contains("text-leaf")).toBe(isCurrent);
      expect(link.classList.contains("font-medium")).toBe(!isCurrent);
      expect(link.classList.contains("text-ink")).toBe(!isCurrent);
    }
  });
});

describe("takeover tier and right-side order", () => {
  it("the hamburger wrapper retires by lg:hidden but stays mounted and wired", () => {
    render(<SiteHeader />);
    const button = need(screen.queryByTestId("header-menu-button"), "menu button");
    expect(button.getAttribute("aria-controls")).toBe("header-menu-panel");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const wrapper = need(button.parentElement, "menu wrapper");
    expect(wrapper.classList.contains("lg:hidden")).toBe(true);
    expect(wrapper.classList.contains("relative")).toBe(true);
    // The panel is still in the DOM (CSS-only retirement), closed.
    expect(need(screen.queryByTestId("header-menu"), "menu panel").hasAttribute("hidden")).toBe(true);
  });

  it("the byline stays visible at the takeover tier (lever 1 alone meets the §6 fit: ≥24px slack, no truncation; lever 2 not applied)", () => {
    render(<SiteHeader />);
    const byline = screen.getByText("by Hues Floral Park");
    // Visible at and above lg: hidden below the tier, block at the takeover tier.
    expect(byline.classList.contains("hidden")).toBe(true);
    expect(byline.classList.contains("lg:block")).toBe(true);
    // The fit lever is the nav padding, not the byline: every link keeps px-3 below lg
    // and narrows to lg:px-2 at the takeover tier. This conjunction fails on the merge
    // base (four links, no lg:px-2) and passes on this branch.
    const navEl = screen.getByRole("navigation", { name: "Main" });
    const links = within(navEl).getAllByRole("link");
    expect(links).toHaveLength(EXPECTED_NAV.length);
    for (const link of links) {
      expect(link.className).toContain("px-3");
      expect(link.className).toContain("lg:px-2");
    }
  });

  it("the account icon is unchanged and sits before the menu in DOM order", () => {
    render(<SiteHeader />);
    const account = need(screen.queryByTestId("header-account"), "account link");
    expect(account.getAttribute("aria-label")).toBe("Your account");
    expect(account.getAttribute("href")).toBe("/account");
    const menuButton = need(screen.queryByTestId("header-menu-button"), "menu button");
    expect(account.compareDocumentPosition(menuButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("hamburger menu behavior below the tier (unchanged)", () => {
  function openMenu(): { button: HTMLElement; panel: HTMLElement } {
    render(<SiteHeader />);
    const button = need(screen.queryByTestId("header-menu-button"), "menu button");
    const panel = need(screen.queryByTestId("header-menu"), "menu panel");
    fireEvent.click(button);
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    return { button, panel };
  }

  it("starts closed; opening focuses the first link; the panel lists all seven destinations", () => {
    render(<SiteHeader />);
    const button = need(screen.queryByTestId("header-menu-button"), "menu button");
    const panel = need(screen.queryByTestId("header-menu"), "menu panel");
    expect(panel.hasAttribute("hidden")).toBe(true);
    fireEvent.click(button);
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const items = within(panel).getAllByRole("link");
    expect(items).toHaveLength(EXPECTED_MENU_LABELS.length);
    expect(items.map((l) => l.textContent)).toEqual(EXPECTED_MENU_LABELS);
    expect(document.activeElement).toBe(items[0]);
  });

  it("Escape closes and returns focus to the button", () => {
    const { button, panel } = openMenu();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it("pointerdown outside closes", () => {
    const { panel } = openMenu();
    fireEvent.pointerDown(document.body);
    expect(panel.hasAttribute("hidden")).toBe(true);
  });

  it("a route change closes the mounted menu", () => {
    // NOTE: rerender keeps the mount; cleanup+render would prove nothing (fresh mounts start closed).
    nav.pathname = HEADER_NAV[0]!.href;
    const view = render(<SiteHeader />);
    fireEvent.click(need(screen.queryByTestId("header-menu-button"), "menu button"));
    expect(need(screen.queryByTestId("header-menu"), "menu panel").hasAttribute("hidden")).toBe(false);
    nav.pathname = HEADER_NAV[2]!.href;
    view.rerender(<SiteHeader />);
    expect(need(screen.queryByTestId("header-menu"), "menu panel").hasAttribute("hidden")).toBe(true);
  });
});

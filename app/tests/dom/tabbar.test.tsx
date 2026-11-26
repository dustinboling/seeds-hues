// @vitest-environment jsdom
/**
 * Tab-bar contract (preview visual fix): the shell mounts the ported live
 * tab bar — a nav labelled "Primary" with exactly the five live tabs (href
 * + visible label + an SVG icon each), the active link carrying
 * aria-current on a matching route, and no placeholder remnant anywhere.
 * Active matching mirrors v2's TabBar exactly.
 */
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import type { PageContext } from "vike/types";
import { VikeReactProviderPageContext } from "vike-react/usePageContext";
import { describe, expect, it } from "vitest";
import Layout from "../../pages/+Layout.js";

const TABS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Home" },
  { href: "/crop", label: "Crops" },
  { href: "/variety", label: "Varieties" },
  { href: "/seller", label: "Sellers" },
  { href: "/search", label: "Search" },
];

function renderShell(urlPathname: string, children: ReactNode = <h1>Test page</h1>) {
  return render(
    <VikeReactProviderPageContext pageContext={{ urlOriginal: urlPathname, urlPathname } as PageContext}>
      <Layout>{children}</Layout>
    </VikeReactProviderPageContext>,
  );
}

function getPrimaryNav(): HTMLElement {
  return screen.getByRole("navigation", { name: "Primary" });
}

describe("tab bar", () => {
  it("renders exactly the five live tabs with href, visible label, and an SVG icon each", () => {
    renderShell("/");
    const nav = getPrimaryNav();
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => `${a.getAttribute("href")} ${a.textContent}`)).toEqual(
      TABS.map((t) => `${t.href} ${t.label}`),
    );
    for (const link of links) {
      expect(link.querySelector("svg"), `${link.textContent} has an icon`).not.toBeNull();
    }
  });

  it.each([
    ["/", "Home"],
    ["/crop", "Crops"],
    ["/crop/wheat", "Crops"],
    ["/series/floret-mix", "Crops"],
    ["/variety", "Varieties"],
    ["/variety/cool-crimson", "Varieties"],
    ["/seller", "Sellers"],
    ["/seller/floret", "Sellers"],
    ["/state/oregon", "Sellers"],
    ["/search", "Search"],
    ["/search", "Search"],
  ])("marks %s active on %s", (pathname, label) => {
    renderShell(pathname);
    const nav = getPrimaryNav();
    const current = within(nav).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual([label]);
  });

  it("marks no tab active off the five sections", () => {
    renderShell("/about");
    const nav = getPrimaryNav();
    expect(
      within(nav)
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current") === "page"),
    ).toHaveLength(0);
  });

  it("leaves no placeholder remnant in the shell", () => {
    renderShell("/");
    expect(document.querySelector("[data-placeholder]")).toBeNull();
    expect(document.querySelector(".tabbar-placeholder, .tabbar-slot, .tabbar-slots")).toBeNull();
  });
});

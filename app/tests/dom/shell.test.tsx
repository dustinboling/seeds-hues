// @vitest-environment jsdom
/**
 * Shell contract (WCAG 2.2 AA): landmarks, skip link, tab-bar placeholder
 * structure, live region, and the route-change focus + announcement mechanics.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import type { PageContext } from "vike/types";
import { VikeReactProviderPageContext } from "vike-react/usePageContext";
import { describe, expect, it } from "vitest";
import Layout from "../../pages/+Layout.js";

function stubPageContext(urlOriginal: string): PageContext {
  return { urlOriginal } as PageContext;
}

function renderShell(urlOriginal: string, children: ReactNode = <h1>Test page</h1>) {
  return render(
    <VikeReactProviderPageContext pageContext={stubPageContext(urlOriginal)}>
      <Layout>{children}</Layout>
    </VikeReactProviderPageContext>,
  );
}

/**
 * The shell now carries labelled header/footer navs alongside the tab-bar
 * placeholder, so the bare "navigation" role query is ambiguous. Select the
 * placeholder by its structural class hook (asserted nowhere) so every
 * landmark/marker assertion below stays meaningful.
 */
function getPlaceholderNav(): HTMLElement {
  const matches = screen.getAllByRole("navigation").filter((el) => el.classList.contains("tabbar-placeholder"));
  expect(matches).toHaveLength(1);
  return matches[0] as HTMLElement;
}

describe("shell landmarks", () => {
  it("renders banner, main, contentinfo, and the placeholder nav", () => {
    renderShell("/");
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    const nav = getPlaceholderNav();
    expect(nav.getAttribute("data-placeholder")).toBe("tab-bar-d1");
    // The empty placeholder must not expose a labelled landmark.
    expect(nav.getAttribute("aria-label")).toBeNull();
    expect(nav.getAttribute("aria-labelledby")).toBeNull();
  });

  it("renders the header wordmark and footer disclosures", () => {
    renderShell("/");
    expect(screen.getByRole("link", { name: "Seed Directory — home" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Seed Directory", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/independent directory, not affiliated/)).toBeTruthy();
    expect(screen.getByText(/Sellers do not pay for placement/)).toBeTruthy();
  });

  it("carries the tab-bar placeholder as five empty slots (structure only)", () => {
    renderShell("/");
    const nav = getPlaceholderNav();
    const slots = nav.querySelectorAll("li.tabbar-slot");
    expect(slots.length).toBe(5);
    for (const slot of slots) {
      expect(slot.getAttribute("aria-hidden")).toBe("true");
      expect(slot.textContent).toBe("");
    }
    expect(nav.querySelectorAll("a, button").length).toBe(0);
  });

  it("skip link targets the main landmark, which is focusable", () => {
    renderShell("/");
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip.getAttribute("href")).toBe("#main");
    const main = screen.getByRole("main");
    expect(main.getAttribute("id")).toBe("main");
    expect(main.getAttribute("tabindex")).toBe("-1");
  });

  it("provides a silent route-announcement live region", () => {
    renderShell("/");
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
  });
});

describe("route changes", () => {
  it("move focus to main and announce the new page title", () => {
    document.title = "First page";
    const view = renderShell("/first");
    expect(screen.getByRole("status").textContent).toBe("");

    document.title = "Second page";
    view.rerender(
      <VikeReactProviderPageContext pageContext={stubPageContext("/second")}>
        <Layout>
          <h1>Second</h1>
        </Layout>
      </VikeReactProviderPageContext>,
    );
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(screen.getByRole("status").textContent).toBe("Second page");
  });
});

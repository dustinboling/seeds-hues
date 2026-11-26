// @vitest-environment jsdom
/**
 * Shell contract (WCAG 2.2 AA): landmarks, skip link, tab bar, live region,
 * and the route-change focus + announcement mechanics. The tab bar's own
 * contract (five tabs, active matching) lives in tabbar.test.tsx.
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

describe("shell landmarks", () => {
  it("renders banner, main, contentinfo, and the labelled tab-bar nav", () => {
    renderShell("/");
    expect(screen.getByRole("banner")).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
  });

  it("renders the header wordmark and footer disclosures", () => {
    renderShell("/");
    expect(screen.getByRole("link", { name: "Seed Directory — home" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Seed Directory", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/independent directory, not affiliated/)).toBeTruthy();
    expect(screen.getByText(/Sellers do not pay for placement/)).toBeTruthy();
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

// @vitest-environment jsdom
/**
 * Slice 8 route-transition focus audit (Ada): the shipped RouteAnnouncer —
 * on every client-side navigation focus moves to the main content and the
 * new page title is announced in a polite live region; the initial load
 * stays silent (the screen reader already reads the fresh page).
 */
import { render, screen } from "@testing-library/react";
import type { PageContext } from "vike/types";
import { VikeReactProviderPageContext } from "vike-react/usePageContext";
import { describe, expect, it } from "vitest";
import { RouteAnnouncer } from "../../src/components/RouteAnnouncer";

function renderAnnouncer(urlOriginal: string) {
  return render(
    <VikeReactProviderPageContext pageContext={{ urlOriginal } as PageContext}>
      <main id="main" tabIndex={-1}>
        <h1>Page</h1>
      </main>
      <RouteAnnouncer />
    </VikeReactProviderPageContext>,
  );
}

function liveRegion(): HTMLElement {
  const region = screen.getByRole("status");
  expect(region.getAttribute("aria-live")).toBe("polite");
  return region;
}

describe("RouteAnnouncer", () => {
  it("stays silent on the initial load: empty live region, focus untouched", () => {
    renderAnnouncer("/variety");
    expect(liveRegion().textContent).toBe("");
    expect(document.activeElement).toBe(document.body);
  });

  it("moves focus to main and announces the new title on client navigation", () => {
    const ui = renderAnnouncer("/variety");
    document.title = "Flower seed sellers | seeds.hues.flowers";
    ui.rerender(
      <VikeReactProviderPageContext pageContext={{ urlOriginal: "/seller" } as PageContext}>
        <main id="main" tabIndex={-1}>
          <h1>Page</h1>
        </main>
        <RouteAnnouncer />
      </VikeReactProviderPageContext>,
    );
    expect(document.activeElement).toBe(document.getElementById("main"));
    expect(liveRegion().textContent).toBe("Flower seed sellers | seeds.hues.flowers");
  });

  it("announces every subsequent navigation with the latest title", () => {
    const ui = renderAnnouncer("/variety");
    document.title = "Second page | seeds.hues.flowers";
    const shell = (urlOriginal: string) => (
      <VikeReactProviderPageContext pageContext={{ urlOriginal } as PageContext}>
        <main id="main" tabIndex={-1}>
          <h1>Page</h1>
        </main>
        <RouteAnnouncer />
      </VikeReactProviderPageContext>
    );
    ui.rerender(shell("/seller"));
    expect(liveRegion().textContent).toBe("Second page | seeds.hues.flowers");
    document.title = "Third page | seeds.hues.flowers";
    ui.rerender(shell("/crop"));
    expect(liveRegion().textContent).toBe("Third page | seeds.hues.flowers");
    expect(document.activeElement).toBe(document.getElementById("main"));
  });

  it("a same-URL rerender announces nothing new", () => {
    const ui = renderAnnouncer("/variety");
    document.title = "Second page | seeds.hues.flowers";
    const shell = (urlOriginal: string) => (
      <VikeReactProviderPageContext pageContext={{ urlOriginal } as PageContext}>
        <main id="main" tabIndex={-1}>
          <h1>Page</h1>
        </main>
        <RouteAnnouncer />
      </VikeReactProviderPageContext>
    );
    ui.rerender(shell("/seller"));
    expect(liveRegion().textContent).toBe("Second page | seeds.hues.flowers");
    document.title = "Unrelated title change | seeds.hues.flowers";
    ui.rerender(shell("/seller"));
    expect(liveRegion().textContent).toBe("Second page | seeds.hues.flowers");
  });

  it("never throws when the main landmark is absent", () => {
    const ui = render(
      <VikeReactProviderPageContext pageContext={{ urlOriginal: "/variety" } as PageContext}>
        <RouteAnnouncer />
      </VikeReactProviderPageContext>,
    );
    document.title = "No main here | seeds.hues.flowers";
    ui.rerender(
      <VikeReactProviderPageContext pageContext={{ urlOriginal: "/seller" } as PageContext}>
        <RouteAnnouncer />
      </VikeReactProviderPageContext>,
    );
    expect(liveRegion().textContent).toBe("No main here | seeds.hues.flowers");
  });
});

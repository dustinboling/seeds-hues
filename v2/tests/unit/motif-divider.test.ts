/**
 * Divider motif B (2026-11-19): the centred ornament for major breaks — the home hero break and the
 * waitlist success moment. Decorative, rendered whole through lib/images.
 *
 * History: it also shipped in a footer-adjacent slot (FooterStem, "footer" variant) on every page;
 * that placement was removed 2026-11-19 at Dustin's direction — the motif's painted ground did not
 * match the page ground and read as a visible band above the footer. Pages now go straight from
 * content to the footer; the SiteFooter regression test below keeps it removed.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MOTIF_B_PATH, MotifDivider } from "@/components/ui/MotifDivider";
import { SiteFooter } from "@/components/layout/SiteFooter";

const T = (w: number) => `https://images.seeds.hues.flowers/cdn-cgi/image/width=${w},quality=80,format=auto,fit=scale-down/ornaments/motif-divider-b.webp`;
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const img = (h: string) => /<img\b[^>]*>/.exec(h)?.[0] ?? "";

describe("MotifDivider (divider motif B)", () => {
  it("renders the stored path only via lib/images, whole and decorative", () => {
    expect(MOTIF_B_PATH).toBe("/ornaments/motif-divider-b.webp");
    const h = renderToStaticMarkup(createElement(MotifDivider, { variant: "home", className: "mb-8 mt-10" }));
    expect(h).toMatch(/^<div aria-hidden="true" data-testid="motif-b" class="w-full mb-8 mt-10"><img /);
    const i = img(h);
    expect(attr(i, "src")).toBe(T(1200));
    expect(attr(i, "srcSet")).toBe(`${T(600)} 600w, ${T(900)} 900w, ${T(1200)} 1200w`);
    expect(attr(i, "alt")).toBe("");
    expect(attr(i, "width")).toBe("2400");
    expect(attr(i, "height")).toBe("518");
    expect(attr(i, "loading")).toBe("lazy");
    expect(attr(i, "decoding")).toBe("async");
    // Shown whole: height follows the intrinsic aspect, never stretched or cropped.
    const cls = (attr(i, "class") ?? "").split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(["mx-auto", "block", "h-auto", "max-w-full"]));
    expect(cls.some((c) => /^(?:object-|h-\[|aspect-)/.test(c))).toBe(false);
    // No vertical margins baked in: only the caller's.
    expect(renderToStaticMarkup(createElement(MotifDivider, { variant: "home" }))).toMatch(/^<div aria-hidden="true" data-testid="motif-b" class="w-full">/);
  });

  it("sizes each placement inside its guidance band, with sizes matching the CSS width", () => {
    const home = img(renderToStaticMarkup(createElement(MotifDivider, { variant: "home" })));
    expect(attr(home, "sizes")).toBe("min(480px, 92vw)");
    expect(attr(home, "class")).toContain("w-[min(480px,92vw)]");
  });

  it("gives way to the thin stem rule below a 360px viewport (shared markup, every variant)", () => {
    for (const variant of ["home", "success"] as const) {
      const h = renderToStaticMarkup(createElement(MotifDivider, { variant }));
      expect(attr(img(h), "class"), variant).toContain("max-[360px]:hidden");
      expect(h, variant).toContain('<span class="divider-stem hidden max-[360px]:block"></span>');
    }
  });

  it("is not placed adjacent to the footer: SiteFooter renders no footer-stem slot and no motif", () => {
    const h = renderToStaticMarkup(createElement(SiteFooter));
    // The <footer> element is the component's whole output: nothing renders before or after it
    // (React 19 prepends a <link rel="preload"> resource hint for the logo image; not an element).
    expect(h.replace(/^(?:<link rel="preload"[^>]*\/>)+/, "")).toMatch(/^<footer\b[\s\S]*<\/footer>$/);
    expect(h).not.toContain("footer-stem");
    expect(h).not.toContain("motif-b");
    expect(h).not.toContain(MOTIF_B_PATH.slice(1));
    expect(h).not.toContain("ornaments/");
    // The only image in the footer is the Hues wordmark — no motif image.
    expect([...h.matchAll(/<img\b[^>]*>/g)].map((m) => attr(m[0], "src"))).toEqual(["/brand/hues-logo.svg"]);
  });
});

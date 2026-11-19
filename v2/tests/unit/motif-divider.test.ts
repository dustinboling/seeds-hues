/**
 * Divider motif B (2026-11-19): the centred ornament for major breaks — the home hero break and the
 * footer-adjacent slot (FooterStem). Decorative, rendered whole through lib/images.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MOTIF_B_PATH, MotifDivider } from "@/components/ui/MotifDivider";
import { FooterStem } from "@/components/layout/FooterStem";

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
    const footer = img(renderToStaticMarkup(createElement(MotifDivider, { variant: "footer" })));
    expect(attr(footer, "sizes")).toBe("min(440px, 92vw)");
    expect(attr(footer, "class")).toContain("w-[min(440px,92vw)]");
  });

  it("gives way to the thin stem rule below a 360px viewport", () => {
    const h = renderToStaticMarkup(createElement(MotifDivider, { variant: "footer" }));
    expect(attr(img(h), "class")).toContain("max-[360px]:hidden");
    expect(h).toContain('<span class="divider-stem hidden max-[360px]:block"></span>');
  });

  it("FooterStem renders the footer-variant motif in its slot on the server", () => {
    const h = renderToStaticMarkup(createElement(FooterStem));
    expect(h).toMatch(/^<div aria-hidden="true" class="mb-10 mt-16" data-testid="footer-stem"><div aria-hidden="true" data-testid="motif-b" class="w-full"><img /);
    expect(attr(img(h), "sizes")).toBe("min(440px, 92vw)");
    expect(h).not.toContain("<footer");
  });
});

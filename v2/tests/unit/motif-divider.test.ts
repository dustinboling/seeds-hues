/**
 * Divider motif B — RETIRED 2026-11-21 at Dustin's direction: removed from the site entirely.
 * Its last two placements are gone: the home hero break now uses the site's standard thin-stem
 * divider rule, and the waitlist success moment carries no ornament. (The R2 asset and its
 * image-manifest entry stay until the separate asset-retirement operation; the waitlist success
 * wording is unchanged.) The component file itself is deleted; these tests pin the new truth
 * and fail on the old code. The waitlist success render is pinned in tests/dom/waitlist-success.
 *
 * History: motif B also shipped in a footer-adjacent slot on every page; that placement was
 * removed 2026-11-19 at Dustin's direction — the motif's painted ground did not match the page
 * ground and read as a visible band above the footer. On 2026-11-20 Dustin directed the slot's
 * original occupant restored instead: FooterStem renders the thin divider-stem rule (theme §3),
 * a transparent-ground vector that takes the page's own paper and cannot band. The SiteFooter
 * regression test below keeps Motif B out of the slot and the stem in it.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FooterStem } from "@/components/layout/FooterStem";
import { SiteFooter } from "@/components/layout/SiteFooter";

const MOTIF_B_KEY = "ornaments/motif-divider-b.webp";
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

describe("Motif B retirement (2026-11-21)", () => {
  it("the component is gone: no file, no live reference in either former placement", () => {
    expect(existsSync(join(process.cwd(), "components/ui/MotifDivider.tsx"))).toBe(false);
    for (const f of ["app/page.tsx", "components/variety/WaitlistBlock.tsx"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toContain("MotifDivider");
      expect(src, f).not.toContain("motif-divider-b");
      expect(src, f).not.toContain("MOTIF_B");
    }
  });

  it("home hero break: the thin-stem divider rule sits between the hero and Browse by crop", () => {
    const src = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const stem = '<div aria-hidden="true" className="divider-stem mb-8 mt-10" />';
    const at = src.indexOf(stem);
    expect(at).toBeGreaterThanOrEqual(0);
    // Exactly one hero-break rule, ordered between the two sections.
    expect(src.indexOf(stem, at + 1)).toBe(-1);
    expect(src.indexOf('id="hero-title"')).toBeLessThan(at);
    expect(at).toBeLessThan(src.indexOf('id="crops-title"'));
  });

  it("FooterStem renders the thin stem rule in its slot in server HTML (suppression is client-side)", () => {
    const h = renderToStaticMarkup(createElement(FooterStem));
    expect(h).toBe('<div aria-hidden="true" class="divider-stem mt-16" data-testid="footer-stem"></div>');
  });

  it("is not placed adjacent to the footer: SiteFooter renders the thin stem rule above the footer and no Motif B band", () => {
    const h = renderToStaticMarkup(createElement(SiteFooter));
    // The stem slot renders first, then the <footer> element, and nothing after it: the rule sits
    // above the footer on the page ground, never inside the paper-deep footer element.
    // (React 19 prepends a <link rel="preload"> resource hint for the logo image; not an element.)
    expect(h.replace(/^(?:<link rel="preload"[^>]*\/>)+/, "")).toMatch(
      /^<div aria-hidden="true" class="divider-stem mt-16" data-testid="footer-stem"><\/div>(?:<!-- -->)?<footer\b[\s\S]*<\/footer>$/,
    );
    expect(h).not.toContain("motif-b");
    expect(h).not.toContain(MOTIF_B_KEY);
    expect(h).not.toContain("ornaments/");
    // The only image in the footer is the Hues wordmark — the stem is a CSS background, not an <img>.
    expect([...h.matchAll(/<img\b[^>]*>/g)].map((m) => attr(m[0], "src"))).toEqual(["/brand/hues-logo.svg"]);
  });
});

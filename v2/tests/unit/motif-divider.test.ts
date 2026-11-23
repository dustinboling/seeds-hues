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
 *
 * 2026-11-22: the home hero break swapped again — the thin-stem rule there was replaced by the
 * C3 — Vine & Pods, Revised (love-in-a-puff) motif (HomeMotifDivider, approved by Dustin). The
 * break test below pins the new occupant; every other stem instance is unchanged.
 *
 * 2026-11-22 (later): the forced-colors hide rule moved out of @layer components to an
 * unlayered kill-switch, and the img's redundant `block h-auto w-full` went away — the
 * `block` utility (utilities layer) had beaten the layered hide rule at the build gate.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FooterStem } from "@/components/layout/FooterStem";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HomeMotifDivider } from "@/components/ui/HomeMotifDivider";

const MOTIF_B_KEY = "ornaments/motif-divider-b.webp";
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;

/**
 * Every Tailwind display utility: each compiles into @layer utilities, which beats the
 * components layer regardless of specificity — any one of these on the motif img would
 * defeat a components-layer forced-colors hide rule (build gate 2026-11-22).
 */
const DISPLAY_UTILITIES = new Set([
  "block", "inline-block", "inline", "flex", "inline-flex", "table", "inline-table",
  "table-caption", "table-cell", "table-column", "table-column-group", "table-footer-group",
  "table-header-group", "table-row-group", "table-row", "flow-root", "grid", "inline-grid",
  "contents", "list-item", "hidden",
]);

/**
 * Blank out every `@layer … { … }` block (brace-matched, comments skipped) so a test can
 * assert a rule sits in unlayered CSS. Unlayered author CSS beats all layered CSS.
 */
function stripLayerBlocks(css: string): string {
  const parts: string[] = [];
  let i = 0;
  const n = css.length;
  const skipComment = (k: number): number => {
    const end = css.indexOf("*/", k + 2);
    return end < 0 ? n : end + 2;
  };
  while (i < n) {
    if (css.startsWith("/*", i)) {
      const stop = skipComment(i);
      parts.push(css.slice(i, stop));
      i = stop;
      continue;
    }
    if (css.startsWith("@layer", i) && !/[A-Za-z0-9_-]/.test(css[i + 6] ?? "")) {
      const open = css.indexOf("{", i);
      const semi = css.indexOf(";", i);
      if (open >= 0 && (semi < 0 || open < semi)) {
        let depth = 0;
        let j = open;
        while (j < n) {
          if (css.startsWith("/*", j)) {
            j = skipComment(j);
            continue;
          }
          if (css[j] === "{") depth++;
          else if (css[j] === "}" && --depth === 0) {
            j++;
            break;
          }
          j++;
        }
        i = j;
        continue;
      }
    }
    parts.push(css[i] ?? "");
    i++;
  }
  return parts.join("");
}

describe("Motif B retirement (2026-11-21)", () => {
  it("the component is gone: no file, no live reference in either former placement", () => {
    expect(existsSync(join(process.cwd(), "components/ui/MotifDivider.tsx"))).toBe(false);
    for (const f of ["app/page.tsx", "components/variety/WaitlistBlock.tsx"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      // Word-bound: the retired Motif B component — not the C3 HomeMotifDivider, whose
      // name contains it as a substring.
      expect(src, f).not.toMatch(/(?<![A-Za-z0-9_$])MotifDivider(?![A-Za-z0-9_$])/);
      expect(src, f).not.toContain("motif-divider-b");
      expect(src, f).not.toContain("MOTIF_B");
    }
  });

  it("home hero break: the C3 motif divider sits between the hero and Recently restocked (no stem rule)", () => {
    const src = readFileSync(join(process.cwd(), "app/page.tsx"), "utf8");
    const at = src.indexOf("<HomeMotifDivider />");
    expect(at).toBeGreaterThanOrEqual(0);
    // Exactly one hero-break divider, ordered between the two sections (Tranche 3.4 §5.1:
    // Recently restocked moved above Browse by crop).
    expect(src.indexOf("<HomeMotifDivider />", at + 1)).toBe(-1);
    expect(src.indexOf('id="hero-title"')).toBeLessThan(at);
    expect(at).toBeLessThan(src.indexOf('id="recent-title"'));
    expect(src.indexOf('id="recent-title"')).toBeLessThan(src.indexOf('id="crops-title"'));
    // The stem rule is gone from the break — but the crop packet cards below keep
    // their mini rules (a different class), and the footer stem is untouched.
    // Tranche 3.1b-1: the packet cards render from the home browse component the
    // in-place layer hydrates — the mini-rule pin follows the markup there.
    expect(src).not.toContain("divider-stem mb-8 mt-10");
    expect(readFileSync(join(process.cwd(), "components/home/HomeBrowse.tsx"), "utf8")).toContain(
      'className="divider-stem-mini mt-1"',
    );
    expect(src).toContain('from "@/components/ui/HomeMotifDivider"');
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

describe("HomeMotifDivider (C3 swap, 2026-11-22)", () => {
  const CDN = "https://images.seeds.hues.flowers";
  const T = (width: number) => `${CDN}/cdn-cgi/image/width=${width},quality=80,format=auto,fit=scale-down/theme/divider-home.webp`;
  const html = renderToStaticMarkup(createElement(HomeMotifDivider));
  const figure = /<figure\b[^>]*>/.exec(html)?.[0] ?? "";
  const tag = /<img\b[^>]*>/.exec(html)?.[0] ?? "";

  it("renders one decorative figure with the break spacing (margins unchanged from the stem rule)", () => {
    expect([...html.matchAll(/<figure\b/g)]).toHaveLength(1);
    expect(attr(figure, "aria-hidden")).toBe("true");
    expect(attr(figure, "data-testid")).toBe("home-motif");
    expect(attr(figure, "class")).toBe("divider-home mb-8 mt-10");
  });

  it("renders one img: 1440 src, exact 720/1080/1440 srcset, exact sizes, 2400×365, lazy/async, no priority, no class", () => {
    expect([...html.matchAll(/<img\b[^>]*>/g)]).toHaveLength(1);
    expect(attr(tag, "src")).toBe(T(1440));
    expect(attr(tag, "srcSet") ?? attr(tag, "srcset")).toBe(`${T(720)} 720w, ${T(1080)} 1080w, ${T(1440)} 1440w`);
    expect(attr(tag, "sizes")).toBe("(min-width: 672px) 640px, calc(100vw - 32px)");
    expect(attr(tag, "alt")).toBe("");
    expect(attr(tag, "width")).toBe("2400");
    expect(attr(tag, "height")).toBe("365");
    expect(attr(tag, "loading")).toBe("lazy");
    expect(attr(tag, "decoding")).toBe("async");
    expect(tag).not.toMatch(/fetchpriority/i);
    // No class at all: sizing comes from the .divider-home img rule, and a display
    // utility here would beat the forced-colors hide rule (gate 2026-11-22).
    expect(attr(tag, "class")).toBe(null);
  });

  it("the img carries no display utility: any of them sits in @layer utilities and would beat a layered hide rule", () => {
    // The gate failure, pinned relationally: class="block …" kept the motif rendered
    // under forced-colors while the CSS-text pin below passed. A computed-style
    // assertion is impossible in this stack (jsdom: no matchMedia, no @layer or
    // @media evaluation), so the suite pins the invariant instead: nothing on the img
    // competes with the hide rule, and the hide rule sits where it wins (next test).
    const classes = (attr(tag, "class") ?? "").split(/\s+/).filter(Boolean);
    expect(classes.filter((c) => DISPLAY_UTILITIES.has(c))).toEqual([]);
  });

  it("pins the size token and the .divider-home rule (640px cap, centred, img fills, forced-colors hides)", () => {
    const tokens = JSON.parse(readFileSync(join(process.cwd(), "design-tokens/tokens.json"), "utf8")) as {
      size: { "divider-home": { $value: string; $extensions: { "seeds-hues": { cssVariable: string } } } };
      component: { "divider-home": { "aspect-ratio": { $value: string }; asset: { $value: string } } };
    };
    expect(tokens.size["divider-home"].$value).toBe("640px");
    expect(tokens.size["divider-home"].$extensions["seeds-hues"].cssVariable).toBe("--size-divider-home");
    expect(tokens.component["divider-home"]["aspect-ratio"].$value).toBe("2400/365");
    expect(tokens.component["divider-home"].asset.$value).toBe("/theme/divider-home.webp");
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/--size-divider-home:\s*640px;/);
    expect(css).toMatch(/\.divider-home\s*\{[^}]*width:\s*min\(100%,\s*var\(--size-divider-home\)\)[^}]*margin-inline:\s*auto[^}]*\}/);
    expect(css).toMatch(/\.divider-home img\s*\{[^}]*display:\s*block[^}]*width:\s*100%[^}]*height:\s*auto[^}]*\}/);
    expect(css).toMatch(/@media\s*\(forced-colors:\s*active\)\s*\{\s*\.divider-home img\s*\{\s*display:\s*none;\s*\}\s*\}/);
  });

  it("the forced-colors hide rule is unlayered, so it beats every @layer (it lost from inside components once)", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    const hide = /@media\s*\(forced-colors:\s*active\)\s*\{\s*\.divider-home img\s*\{\s*display:\s*none;\s*\}\s*\}/;
    expect(css).toMatch(hide);
    // Placement, not just existence: the rule must survive with every @layer block
    // blanked out — i.e. it sits in unlayered CSS, which beats all layered CSS.
    expect(stripLayerBlocks(css)).toMatch(hide);
  });
});

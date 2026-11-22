/**
 * Tranche 1.3 — Ada's three accessibility fixes (2026-11-19 prescription, audit 2026-11-21 §6).
 *
 * 1. Status-badge border alphas to the nearest passing per-tone value (WCAG 1.4.11, 3:1
 *    against each badge's own ground) in Availability's TONE map and AccountPanel's
 *    StatusLine badges, with no /40 border left on those five tones anywhere in the app.
 * 2. The line-strong token to #91825C (3:1 on paper-deep, paper and surface).
 * 3. aria-live="polite" + aria-atomic="true" on the home filter-result count.
 *
 * Every assertion below fails on the pre-fix code (checked via `git stash`) and passes
 * after it. AvailabilityBadge renders in isolation; AccountPanel needs the Next router
 * and the home page needs live services, so those two are pinned by source assertions —
 * the same pattern the variety-filter suite uses for wiring static markup cannot show.
 *
 * Tranche 2.2 re-pinning (values unchanged): the badge family moved the per-tone
 * ground/text/border values from hand-written utilities into globals.css tone rules
 * (.badge plus one .badge-* class) at byte-identical computed values. The Fix 1 pins
 * below follow the values to their new home: rendered markup carries the family
 * classes, and the tone rules carry Ada's prescribed alphas.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvailabilityBadge } from "@/components/variety/Availability";
import type { Availability } from "@/lib/validators";

const ROOT = process.cwd();

function walk(dir: string, exts = /\.(ts|tsx|css)$/): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(name)) out.push(p);
  }
  return out;
}

describe("Fix 1 — Availability badge borders (rendered plus tone rules)", () => {
  // Ada's prescribed per-tone values: tone class, ground, text, and the border at the
  // nearest passing alpha for each tone's own ground. Since Tranche 2.2 the values live
  // in the globals.css tone rules; the border declarations use the exact color-mix
  // serialization Tailwind v4 emits for the border utilities they replaced.
  const PRESCRIBED: Record<Availability, { tone: string; ground: string; text: string; border: string }> = {
    in_stock: {
      tone: "badge-in-stock",
      ground: "var(--color-leaf-50)",
      text: "var(--color-leaf)",
      border: "color-mix(in oklab, var(--color-leaf) 60%, transparent)",
    },
    sold_out: {
      tone: "badge-sold-out",
      ground: "var(--color-petal-50)",
      text: "var(--color-petal)",
      border: "color-mix(in oklab, var(--color-petal) 65%, transparent)",
    },
    preorder: {
      tone: "badge-preorder",
      ground: "var(--color-surface)",
      text: "var(--color-leaf-600)",
      border: "color-mix(in oklab, var(--color-leaf-600) 70%, transparent)",
    },
    shop_closed: {
      tone: "badge-shop-closed",
      ground: "var(--color-surface)",
      text: "var(--color-muted)",
      border: "color-mix(in oklab, var(--color-muted) 70%, transparent)",
    },
    unknown: {
      tone: "badge-unknown",
      ground: "var(--color-warn-50)",
      text: "var(--color-warn)",
      border: "color-mix(in oklab, var(--color-warn) 75%, transparent)",
    },
  };
  const OLD: Record<Availability, string> = {
    in_stock: "border-leaf/40",
    sold_out: "border-petal/40",
    preorder: "border-leaf-600/40",
    shop_closed: "border-muted/40",
    unknown: "border-warn/40",
  };
  const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");

  function ruleFor(selector: string): string {
    return css.match(new RegExp(`\\.${selector} \\{[\\s\\S]*?\\n  \\}`))?.[0] ?? "";
  }

  for (const value of Object.keys(PRESCRIBED) as Availability[]) {
    it(`${value} renders the family base plus its tone class (was ${OLD[value]})`, () => {
      const h = renderToStaticMarkup(createElement(AvailabilityBadge, { value }));
      expect(h).toContain(`badge ${PRESCRIBED[value].tone}`);
      expect(h).not.toContain(OLD[value]);
    });

    it(`${value} tone rule carries the prescribed ground, text and border alpha`, () => {
      const rule = ruleFor(PRESCRIBED[value].tone);
      expect(rule, `${PRESCRIBED[value].tone} rule is missing`).not.toBe("");
      expect(rule).toContain(`background-color: ${PRESCRIBED[value].ground};`);
      expect(rule).toContain(`color: ${PRESCRIBED[value].text};`);
      expect(rule).toContain(`border-color: ${PRESCRIBED[value].border};`);
    });
  }

  it("keeps the standard pill construction and the shared base (values moved, not changed)", () => {
    for (const value of Object.keys(PRESCRIBED) as Availability[]) {
      const h = renderToStaticMarkup(createElement(AvailabilityBadge, { value }));
      expect(h, value).toContain("px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]");
    }
    const base = ruleFor("badge");
    expect(base, ".badge rule is missing").not.toBe("");
    expect(base).toContain("display: inline-flex;");
    expect(base).toContain("align-items: center;");
    expect(base).toContain("border: 1px solid;");
    expect(base).toContain("border-radius: 999px;");
    expect(base).toContain("font-family: var(--font-sans);");
  });
});

describe("Fix 1 — AccountPanel status badges (source)", () => {
  const panel = readFileSync(join(ROOT, "components/account/AccountPanel.tsx"), "utf8");

  it("Found carries the in-stock tone", () => {
    expect(panel).toContain('badge badge-in-stock px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]">Found');
  });

  it("Waiting · active carries the preorder tone", () => {
    expect(panel).toContain('badge badge-preorder px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]">Waiting · active');
  });

  it("Held carries the unknown tone", () => {
    expect(panel).toContain('badge badge-unknown px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em]">Held');
  });

  it("no /40 border remains on those tones in AccountPanel", () => {
    for (const old of ["border-leaf/40", "border-leaf-600/40", "border-warn/40"]) {
      expect(panel, old).not.toContain(old);
    }
  });
});

describe("Fix 1 — completeness: no /40 status-badge border anywhere in the app", () => {
  it("no border at /40 on leaf, petal, leaf-600, muted or warn in app/components/lib", () => {
    const files = ["app", "components", "lib"].flatMap((d) => walk(d));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      // leaf-600 first: a plain leaf alternative would still match inside border-leaf-600/40.
      const hits = src.match(/border-(?:leaf-600|leaf|petal|muted|warn)\/40/g) ?? [];
      for (const hit of hits) offenders.push(`${f}: ${hit}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe("Fix 2 — line-strong token (source)", () => {
  const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");

  it("is #91825C", () => {
    expect(css).toContain("--color-line-strong: #91825C;");
    expect(css).not.toMatch(/#97865f/i);
  });

  it("the token comment states the truth for all three grounds", () => {
    const line = css.split("\n").find((l) => l.includes("--color-line-strong:")) ?? "";
    expect(line).not.toBe("");
    // Computed from the hex values: 3.36:1 on paper, 3.72:1 on surface, 3.02:1 on paper-deep.
    expect(line).toContain("paper");
    expect(line).toContain("surface");
    expect(line).toContain("paper-deep");
  });
});

describe("Fix 3 — home filter-result count live region (source)", () => {
  const page = readFileSync(join(ROOT, "app/page.tsx"), "utf8");

  it('carries aria-live="polite" and aria-atomic="true", with no other change', () => {
    expect(page).toContain('<p className="mt-3 text-muted" data-testid="filter-result" aria-live="polite" aria-atomic="true">');
    expect(page.match(/data-testid="filter-result"/g) ?? []).toHaveLength(1);
  });
});

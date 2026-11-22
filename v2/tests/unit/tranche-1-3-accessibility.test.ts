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

describe("Fix 1 — Availability badge borders (rendered)", () => {
  // Ada's prescribed per-tone alphas: the nearest passing value for each tone's own ground.
  const PRESCRIBED: Record<Availability, string> = {
    in_stock: "border-leaf/60",
    sold_out: "border-petal/65",
    preorder: "border-leaf-600/70",
    shop_closed: "border-muted/70",
    unknown: "border-warn/75",
  };
  const OLD: Record<Availability, string> = {
    in_stock: "border-leaf/40",
    sold_out: "border-petal/40",
    preorder: "border-leaf-600/40",
    shop_closed: "border-muted/40",
    unknown: "border-warn/40",
  };

  for (const value of Object.keys(PRESCRIBED) as Availability[]) {
    it(`${value} carries ${PRESCRIBED[value]} (was ${OLD[value]})`, () => {
      const h = renderToStaticMarkup(createElement(AvailabilityBadge, { value }));
      expect(h).toContain(PRESCRIBED[value]);
      expect(h).not.toContain(OLD[value]);
    });
  }

  it("keeps the badge grounds, text colors and shape (only the border alpha changes)", () => {
    const grounds: Record<Availability, [string, string]> = {
      in_stock: ["bg-leaf-50", "text-leaf"],
      sold_out: ["bg-petal-50", "text-petal"],
      preorder: ["bg-surface", "text-leaf-600"],
      shop_closed: ["bg-surface", "text-muted"],
      unknown: ["bg-warn-50", "text-warn"],
    };
    for (const value of Object.keys(grounds) as Availability[]) {
      const h = renderToStaticMarkup(createElement(AvailabilityBadge, { value }));
      for (const cls of grounds[value]) expect(h, value).toContain(cls);
      expect(h, value).toContain("rounded-full border");
    }
  });
});

describe("Fix 1 — AccountPanel status badges (source)", () => {
  const panel = readFileSync(join(ROOT, "components/account/AccountPanel.tsx"), "utf8");

  it("Found carries border-leaf/60", () => {
    expect(panel).toContain('border-leaf/60 bg-leaf-50 px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.06em] text-leaf">Found');
  });

  it("Waiting · active carries border-leaf-600/70", () => {
    expect(panel).toContain('border-leaf-600/70 bg-surface px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.06em] text-leaf-600">Waiting · active');
  });

  it("Held carries border-warn/75", () => {
    expect(panel).toContain('border-warn/75 bg-warn-50 px-2 py-0.5 font-sans text-xs font-bold uppercase tracking-[0.06em] text-warn">Held');
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

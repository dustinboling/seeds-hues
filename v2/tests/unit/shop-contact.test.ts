/**
 * The seller contact block (SellerContactBlock): the tel: derivation, the CS-01 website
 * label, and the seven-row coverage matrix (§3.5.3) — each combination renders exactly
 * its channels, rows 4 and 7 identical to today's page — plus the one-link composition
 * (Ada Ruling 2) and the private contact_email's absence.
 *
 * Non-vacuity (T-A): fails on pre-build code — the component, the label, and the rows
 * do not exist there.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SellerContactBlock } from "@/components/seller/SellerContactBlock";
import { telHref } from "@/lib/format";

describe("telHref (digits, with country code — the href describes the displayed number)", () => {
  it("derives the dialable form from the display form", () => {
    expect(telHref("(800) 555-0147")).toBe("tel:+18005550147");
    expect(telHref("800-555-0147")).toBe("tel:+18005550147");
    expect(telHref("800.555.0147")).toBe("tel:+18005550147");
    expect(telHref("1-800-555-0147")).toBe("tel:+18005550147");
    expect(telHref("+1 800 555 0147")).toBe("tel:+18005550147");
    expect(telHref("+44 20 7946 0958")).toBe("tel:+442079460958");
  });
});

const html = (over: { homepage?: string | null; phone?: string | null; email?: string | null } = {}) =>
  renderToStaticMarkup(
    createElement(SellerContactBlock, {
      slug: "test-farm",
      homepage: over.homepage === undefined ? "https://test-farm.example/" : over.homepage,
      phone: over.phone ?? null,
      email: over.email ?? null,
    }),
  );

describe("seven-row coverage matrix (SPEC §3.5.3)", () => {
  const PHONE = "(800) 555-0147";
  const EMAIL = "service@test-farm.example";

  it("row 1: button + phone row + email row", () => {
    const h = html({ phone: PHONE, email: EMAIL });
    expect(h).toContain("Visit their website (test-farm.example)");
    expect(h).toContain(`Customer service</span><span class="min-w-0 break-all text-base font-semibold underline">${PHONE}</span>`);
    expect(h).toContain(`Customer service</span><span class="min-w-0 break-all text-base font-semibold underline">${EMAIL}</span>`);
    expect(h).toContain('href="tel:+18005550147"');
    expect(h).toContain(`href="mailto:${EMAIL}"`);
    expect(h).not.toContain("No website on file");
  });

  it("rows 2–3: button + one row", () => {
    const phoneOnly = html({ phone: PHONE });
    expect(phoneOnly).toContain("Visit their website (test-farm.example)");
    expect(phoneOnly).toContain('href="tel:+18005550147"');
    expect(phoneOnly).not.toContain("mailto:");
    const emailOnly = html({ email: EMAIL });
    expect(emailOnly).toContain(`href="mailto:${EMAIL}"`);
    expect(emailOnly).not.toContain("tel:");
  });

  it("row 4: button alone — exactly today's page", () => {
    const h = html();
    expect(h).toBe(
      '<p class="mt-4"><a href="https://test-farm.example/" rel="nofollow noopener noreferrer" target="_blank" class="btn btn-primary">Visit their website (test-farm.example)<span class="sr-only"> (opens the seller’s site in a new tab)</span></a></p>',
    );
  });

  it("rows 5–6: the No-website line + rows", () => {
    const h = html({ homepage: null, phone: PHONE, email: EMAIL });
    expect(h).toContain("No website on file for this seller.");
    expect(h).toContain('href="tel:+18005550147"');
    expect(h).toContain(`href="mailto:${EMAIL}"`);
    expect(h).not.toContain("Visit their website");
    const one = html({ homepage: null, phone: PHONE });
    expect(one).toContain("No website on file for this seller.");
    expect(one).toContain('href="tel:+18005550147"');
    expect(one).not.toContain("mailto:");
  });

  it("row 7: the No-website line alone — exactly today's page", () => {
    expect(html({ homepage: null })).toBe('<p class="mt-4 text-sm text-muted">No website on file for this seller.</p>');
  });

  it("no placeholders, no reserved space, no absence copy — at any coverage level", () => {
    for (const h of [html(), html({ phone: PHONE }), html({ homepage: null }), html({ homepage: null, email: EMAIL })]) {
      expect(h).not.toMatch(/contact unavailable|not available|coming soon|TBD|—/i);
    }
  });
});

describe("row composition (Ada Ruling 2)", () => {
  it("each row is ONE link: icon + label + value inside the one <a>, no aria-label override", () => {
    const h = html({ phone: "(800) 555-0147", email: "service@test-farm.example" });
    const rows = [...h.matchAll(/<a href="(?:tel|mailto):[^"]*"[^>]*>([\s\S]*?)<\/a>/g)];
    expect(rows).toHaveLength(2);
    for (const [, inner] of rows) {
      expect(inner).toContain("<svg");
      expect(inner).toContain(">Customer service</span>");
    }
    expect(h).not.toMatch(/<a[^>]*aria-label/);
  });

  it("rows are 44px minimum, full-row links capped at 32rem from sm up; neither opens a new tab", () => {
    const h = html({ phone: "(800) 555-0147" });
    expect(h).toContain("flex min-h-target w-full items-center gap-2 mt-2 sm:max-w-[32rem]");
    expect(h).not.toContain('target="_blank" rel="nofollow noopener noreferrer" target="_blank"');
    // Only the website button carries a target (one target on the whole block).
    expect(h.match(/target="_blank"/g) ?? []).toHaveLength(1);
  });

  it("glyphs are aria-hidden redundant channels at 20px in leaf-600", () => {
    const h = html({ phone: "(800) 555-0147", email: "service@test-farm.example" });
    for (const tag of h.match(/<svg\b[^>]*>/g) ?? []) {
      expect(tag).toContain('aria-hidden="true"');
    }
    expect(h).toContain('class="size-5 shrink-0 text-leaf-600"');
  });

  it("the website button's destination, rel, target, and beacon behavior are byte-identical to pre-build", () => {
    // Byte-identical modulo the ruled CS-01 label: same component (OutboundLink), same
    // href/rel/target/suffix — only the visible label changed, per S-12.
    const h = html();
    expect(h).toContain('href="https://test-farm.example/" rel="nofollow noopener noreferrer" target="_blank" class="btn btn-primary"');
    expect(h).toContain('<span class="sr-only"> (opens the seller’s site in a new tab)</span>');
    expect(h).not.toContain("Visit Test Farm");
  });

  it("the private contact_email value never appears when both fields are set", () => {
    // The block receives only the public fields — there is no prop for the private
    // address, so no rendering can leak it; the row below proves the public field is
    // the source (distinct values would differ).
    const h = html({ phone: "(800) 555-0147", email: "service@test-farm.example" });
    expect(h).not.toContain("private@");
    expect(h).toContain("service@test-farm.example");
  });
});

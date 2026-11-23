/**
 * Tranche 3.3 — shared set UI and iconography: the inline error line, the summary box, and the
 * two field glyphs built to the public icon-family rules. Fails on pre-build code:
 * components/ui/field-states.tsx does not exist and icons.tsx exports neither glyph.
 */
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldErrorIcon, FieldSuccessIcon } from "@/components/layout/icons";
import { FieldErrorLine, FieldSummary } from "@/components/ui/field-states";

describe("3.3 — shared error line and summary box", () => {
  it("renders the error line with its id, glyph, and words — and no announcing role", () => {
    const html = renderToStaticMarkup(createElement(FieldErrorLine, { id: "name-error", message: "Enter your name." }));
    expect(html).toContain('id="name-error"');
    expect(html).toContain('class="field-error"');
    expect(html).toContain("Enter your name.");
    expect(html).toContain("<svg");
    expect(html).not.toContain("role=");
  });

  it("renders Content A (heading + identical linked entries) only for two-plus errors", () => {
    const entries = [
      { fieldId: "create-name", message: "Enter your name." },
      { fieldId: "create-zip", message: "Enter your ZIP code as 5 digits." },
    ];
    const html = renderToStaticMarkup(createElement(FieldSummary, { heading: "Some fields need attention before creating your account.", entries, summaryRef: createRef<HTMLDivElement>() }));
    expect(html).toContain('class="field-summary"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain("Some fields need attention before creating your account.");
    expect(html).toContain('<a href="#create-name" class="underline">Enter your name.</a>');
    expect(html).toContain('<a href="#create-zip" class="underline">Enter your ZIP code as 5 digits.</a>');

    const single = renderToStaticMarkup(
      createElement(FieldSummary, { heading: "We couldn't sign you in. Please check the form and try again.", entries: [], summaryRef: createRef<HTMLDivElement>() }),
    );
    // Content B: the message itself as the heading, no entry list.
    expect(single).toContain("We couldn&#x27;t sign you in. Please check the form and try again.");
    expect(single).not.toContain("<ul");
  });
});

describe("3.3 — field glyphs follow the public icon-family rules", () => {
  it("draws the warning triangle on the 24px grid in stroke 1.8 currentColor", () => {
    const html = renderToStaticMarkup(createElement(FieldErrorIcon, { className: "size-4" }));
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="size-4"');
    expect(html).toContain("<path");
  });

  it("draws the circled check on the 24px grid in stroke 1.8 currentColor", () => {
    const html = renderToStaticMarkup(createElement(FieldSuccessIcon, { className: "size-5" }));
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill="none"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.8"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<circle");
    expect(html).toContain("<path");
  });
});

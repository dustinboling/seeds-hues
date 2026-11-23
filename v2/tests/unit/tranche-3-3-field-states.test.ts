/**
 * Tranche 3.3 — the public field-state set: CSS state rules and source shape.
 *
 * No component imports: every test reads globals.css or component source as text, so each one
 * fails on pre-build code for its own reason (T-A non-vacuity). Mapping layers, icons, shared
 * UI, and rendered output are covered in the sibling tranche-3-3 files.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const css = () => readFileSync(join(ROOT, "app/globals.css"), "utf8");
const src = (file: string) => readFileSync(join(ROOT, file), "utf8");

describe("3.3 — CSS state rules layer onto an untouched resting .field", () => {
  it("keeps the resting .field rule byte-identical (no transition, no restyle of rest)", () => {
    const resting = [
      "  .field {",
      "    min-height: 44px;",
      "    width: 100%;",
      "    border-radius: var(--radius-field);",
      "    border: 1px solid var(--color-line-strong);",
      "    background: var(--color-surface);",
      "    padding: 0.5rem 0.75rem;",
      "    font-family: var(--font-sans);",
      "  }",
    ].join("\n");
    expect(css()).toContain(resting);
    // The state rules add no transition: one would itself be a resting computed-value change.
    const noComments = css().replace(/\/\*[\s\S]*?\*\//g, " ");
    expect(noComments).not.toMatch(/\.field[^{]*\{[^}]*transition/);
  });

  it("keys the error border to aria-invalid, filled to .field-filled, off to :disabled", () => {
    const text = css();
    expect(text).toMatch(/\.field\[aria-invalid="true"\]\s*\{\s*border-color: var\(--color-warn\);/);
    expect(text).toMatch(/\.field-filled\s*\{\s*border-color: var\(--color-ink-soft\);/);
    expect(text).toMatch(/\.field:disabled\s*\{[^}]*background: var\(--color-paper\);[^}]*border-color: var\(--color-line\);[^}]*color: var\(--color-muted\);[^}]*\}/);
    expect(text).toMatch(/\.field::placeholder\s*\{\s*color: var\(--color-muted\);/);
  });

  it("defines the slot classes with the designed constructions", () => {
    const text = css();
    expect(text).toMatch(/\.field-hint\s*\{\s*color: var\(--color-muted\);/);
    expect(text).toMatch(/\.field-error\s*\{[^}]*display: flex;[^}]*gap: 6px;[^}]*color: var\(--color-warn\);[^}]*\}/);
    expect(text).toMatch(/\.field-summary\s*\{[^}]*background: var\(--color-warn-50\);[^}]*border: 1px solid var\(--color-line-strong\);[^}]*border-radius: var\(--radius-control\);[^}]*padding: 16px;[^}]*\}/);
    expect(text).toMatch(/\.field-summary:focus,[^}]*outline: 3px solid var\(--color-focus\);[^}]*outline-offset: 2px;/);
    expect(text).toMatch(/\.field-success\s*\{[^}]*display: flex;[^}]*flex-direction: column;[^}]*gap: 8px;[^}]*padding: 16px;[^}]*\}/);
    expect(text).toMatch(/\.field-option\.field-option-selected\s*\{[^}]*border-color: var\(--color-leaf\);[^}]*background-color: var\(--color-leaf-50\);[^}]*\}/);
    expect(text).toMatch(/\.field-option:hover\s*\{[^}]*border-color: var\(--color-leaf-600\);[^}]*background: var\(--color-leaf-50\);[^}]*\}/);
  });

  it("sets the leaf accent on native radios/checkboxes and the busy treatment on submits", () => {
    const text = css();
    expect(text).toMatch(/input:is\(\[type="radio"\], \[type="checkbox"\]\)\s*\{\s*accent-color: var\(--color-leaf\);/);
    // Busy: the primary loses its inset edge while ground and colors hold — no fade anywhere.
    expect(text).toMatch(/\.btn-primary:disabled\s*\{\s*box-shadow: none;/);
    expect(text).toMatch(/\.btn:disabled\s*\{\s*cursor: not-allowed;/);
    expect(text).not.toMatch(/\.btn[^{]*\{[^}]*opacity/);
  });
});

describe("3.3 — inventory source shape (F-22 grep-zero and the set's class names)", () => {
  it("retires ReportForm's longhand fields onto .field (grep-zero for the hand-rolled string)", () => {
    const report = src("components/report/ReportForm.tsx");
    expect(report).not.toContain("rounded-field border border-line-strong bg-surface");
    expect(report).toMatch(/className="field"/);
  });

  it("gives CodeEntry the token width and removes the spaced-paste blockers", () => {
    const code = src("components/account/CodeEntry.tsx");
    expect(code).toContain("max-w-[11rem]");
    expect(code).not.toContain("max-w-[9rem]");
    expect(code).not.toMatch(/maxLength/);
    expect(code).not.toMatch(/pattern=/);
    // The lifetime number comes from the service constant, never a typed numeral.
    expect(code).toMatch(/import \{ CODE_TTL_MINUTES \} from "@\/lib\/accounts";/);
    expect(code).toContain("It works for {CODE_TTL_MINUTES} minutes.");
  });

  it("renders the lifetime hint and the W-2 association ids in CodeEntry source", () => {
    const code = src("components/account/CodeEntry.tsx");
    expect(code).toContain("const id = `${props.idPrefix}-code`;");
    expect(code).toContain("const hintId = `${id}-hint`;");
    expect(code).toContain("const errorId = `${id}-error`;");
    expect(code).toContain("aria-describedby={state.fieldError ? `${hintId} ${errorId}` : hintId}");
  });
});

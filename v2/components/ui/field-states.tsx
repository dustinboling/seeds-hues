import type { RefObject } from "react";
import { FieldErrorIcon } from "@/components/layout/icons";

/**
 * Shared public field-state set UI (Tranche 3.3, FIELD-STATES-DESIGN.md §5): the inline error
 * line and the form-head summary box, ported from the admin sheets' reference pattern into the
 * public dialect, plus the two behavior helpers every inventory form shares (failure focus and
 * filled tracking).
 */

/**
 * Split a validator detail ("field: message; field: message", the parseBody shape) into its
 * leading field names, in order, deduped. Only names in `known` are returned, so message text
 * can never inject a field — an unknown name falls through to the form-level message instead.
 */
export function validationFields(detail: string, known: readonly string[]): string[] {
  const out: string[] = [];
  for (const segment of detail.split(";")) {
    const field = /^([a-z][a-z0-9_]*):/.exec(segment.trim())?.[1];
    if (field !== undefined && known.includes(field) && !out.includes(field)) out.push(field);
  }
  return out;
}

/** One summary entry: the field's inline message, character-identical, linking to the field. */
export interface FieldSummaryEntry {
  /** DOM id of the field — or the choice group's first control — the entry links to and focuses. */
  fieldId: string;
  message: string;
}

/**
 * Inline field error (design §5.1): warn glyph + mapped words, wired to its field. It carries
 * no role — announcement comes from the focus move and, where one exists, the summary (a
 * self-announcing line beside a summary would double-announce).
 */
export function FieldErrorLine({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="field-error">
      <FieldErrorIcon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Form-head summary / alert box (design §5.3): one component, two contents. Content A — the
 * multi-error summary — carries the form's own re-verbed heading plus one link per failing
 * field; Content B — a form-level message — carries the message itself as the heading. The
 * entries list renders only for two or more field errors (the admin box's exact composition).
 */
export function FieldSummary({
  heading,
  entries,
  summaryRef,
}: {
  heading: string;
  entries: FieldSummaryEntry[];
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={summaryRef} tabIndex={-1} role="alert" className="field-summary">
      <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
        <FieldErrorIcon className="mt-0.5 size-4 shrink-0" />
        <span>{heading}</span>
      </p>
      {entries.length >= 2 ? (
        <ul className="mt-2 flex flex-col gap-1 font-sans text-sm">
          {entries.map((e) => (
            <li key={e.fieldId}>
              <a href={`#${e.fieldId}`} className="underline">
                {e.message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The contract's focus rule (SPEC §4.2.2): a form-level message or two-plus field errors focus
 * the summary box; a single field error focuses the field itself. Called from an effect on the
 * form's failure state, with refs only — no state writes.
 */
export function focusFailureTarget(summary: HTMLDivElement | null, entries: FieldSummaryEntry[], formMessage: string | null): void {
  if (formMessage !== null || entries.length >= 2) summary?.focus();
  else if (entries.length === 1) document.getElementById(entries[0]!.fieldId)?.focus();
}

/**
 * Filled tracking (design §3.4): toggle .field-filled on a field from its current value.
 * Attached as onBlur/onChange directly on .field inputs, textareas, and selects — choice
 * controls, hidden inputs, and buttons are never filled-tracked. Render-time defaults and
 * prefills carry .field-filled in their initial class instead.
 */
export function syncFilledClass(e: { currentTarget: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement }): void {
  const el = e.currentTarget;
  if (el instanceof HTMLInputElement) {
    switch (el.type) {
      case "checkbox":
      case "radio":
      case "hidden":
      case "submit":
      case "button":
      case "file":
      case "reset":
      case "image":
        return;
    }
  }
  el.classList.toggle("field-filled", el.value !== "");
}

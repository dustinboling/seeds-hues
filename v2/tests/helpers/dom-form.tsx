/**
 * Shared DOM form-submission helper (refactor R2 §1): the render → fill → submit →
 * FormData pattern from tests/dom/busy-form-submission.test.tsx, generalized. The payload
 * is built with `new FormData(form)` — the browser's own construction for a native
 * submission, which is exactly what excludes disabled controls (the BusyForm 2026-11-21
 * defect class). Testing Library's fireEvent is act-wrapped, so when submitDomForm
 * returns, post-submit state (busy labels, disabled submit button) has flushed and the
 * payload reflects what a browser would send.
 *
 * Intended for native-submission forms only (BusyForm and its doubles). Forms that
 * preventDefault and POST JSON via fetch (AddYourFarmForm) or blocks with no submission
 * (WaitlistBlock) don't fit these mechanics and keep their own tests.
 */
import type { ReactElement } from "react";
import { fireEvent, render, type RenderResult } from "@testing-library/react";

/** One field fill: the element id (the label's htmlFor) plus its submitted value. */
export interface DomFieldFill {
  id: string;
  value: string;
}

export interface DomSubmitResult {
  render: RenderResult;
  /** The submitted form (first <form> in the render). */
  form: HTMLFormElement;
  /** The native-submission payload. Handed to the test for assertions. */
  payload: FormData;
}

/**
 * Render a form component, drive field changes, submit it, and construct the
 * native-submission payload. Throws when the render contains no form or a fill id
 * matches no element.
 */
export function submitDomForm(ui: ReactElement, fills: DomFieldFill[] = []): DomSubmitResult {
  const result = render(ui);
  for (const fill of fills) {
    const el = document.getElementById(fill.id);
    if (!el) throw new Error(`submitDomForm: no element with id "${fill.id}"`);
    fireEvent.change(el, { target: { value: fill.value } });
  }
  const form = result.container.querySelector("form");
  if (!form) throw new Error("submitDomForm: rendered no <form>");
  fireEvent.submit(form);
  return { render: result, form, payload: new FormData(form) };
}

/**
 * The browser's own native-submission construction, for tests that drive a custom
 * flow (async alerts, multi-step fills) but still want to assert the payload the
 * way a browser builds it.
 */
export function nativePayload(form: HTMLFormElement): FormData {
  return new FormData(form);
}

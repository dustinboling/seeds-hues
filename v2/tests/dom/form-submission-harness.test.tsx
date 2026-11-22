// @vitest-environment jsdom
/**
 * Harness sensitivity proof (refactor R2 §2): the shared submitDomForm helper must SEE
 * the BusyForm failure mode, not just pass on fixed code. A test-local double replicates
 * the pre-fix pattern (PR #20 root cause: the submit handler disables the wrapping
 * <fieldset>, so the browser excludes every control from the submission data) and the
 * paired test renders the same shape through the real BusyForm. Both go through the §1
 * helper, so the proof covers the helper itself. Until this file, the defect-direction
 * check existed only as a one-time manual gate run.
 */
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup } from "@testing-library/react";
import { BusyForm } from "@/components/admin/BusyForm";
import { submitDomForm } from "../helpers/dom-form";

afterEach(() => cleanup());

/** The pre-fix BusyForm pattern: submit disables the wrapping fieldset. */
function FieldsetDisablingForm() {
  const [busy, setBusy] = useState(false);
  return (
    <form method="post" action="/admin/sign-in/request" onSubmit={() => setBusy(true)}>
      <fieldset disabled={busy}>
        <input type="hidden" name="next" value="/admin" />
        <label htmlFor="double-email">Email</label>
        <input id="double-email" name="email" type="email" defaultValue="" />
        <div>
          <button type="submit">{busy ? "Sending…" : "Email me a code"}</button>
        </div>
      </fieldset>
    </form>
  );
}

describe("form-submission harness sensitivity", () => {
  it("the broken pattern submits EMPTY: disabling the fieldset drops every control", () => {
    const { form, payload } = submitDomForm(<FieldsetDisablingForm />, [{ id: "double-email", value: "dustin@hues.flowers" }]);
    // The defect mechanism engaged: the busy state flushed and disabled the fieldset.
    // (The input's own .disabled IDL stays false — it reflects the element's own flag,
    // not the fieldset's — but the browser still bars it from the submission data.)
    expect(form.querySelector("fieldset")?.disabled).toBe(true);
    // ...so the browser's own construction carries nothing — not even the hidden input.
    expect(payload.get("email")).toBeNull();
    expect(payload.get("next")).toBeNull();
    expect([...payload.keys()]).toEqual([]);
  });

  it("the same shape through the real BusyForm submits INTACT", () => {
    const { form, payload } = submitDomForm(
      <BusyForm action="/admin/sign-in/request" submitLabel="Email me a code" busyLabel="Sending…">
        <input type="hidden" name="next" value="/admin" />
        <label htmlFor="paired-email">Email</label>
        <input id="paired-email" name="email" type="email" defaultValue="" />
      </BusyForm>,
      [{ id: "paired-email", value: "dustin@hues.flowers" }],
    );
    expect(form.querySelector("fieldset")?.disabled).toBe(false);
    expect((document.getElementById("paired-email") as HTMLInputElement).disabled).toBe(false);
    expect(payload.get("email")).toBe("dustin@hues.flowers");
    expect(payload.get("next")).toBe("/admin");
  });
});

// @vitest-environment jsdom
/**
 * BusyForm DOM submission tests (2026-11-21 fix): the admin sign-in submitted EMPTY in
 * a real browser because BusyForm's submit handler disabled its own fields — disabled
 * controls are excluded from a native submission's form data by spec, so the email
 * (step 1) and the code (step 2) never reached the server. Curl-level tests could not
 * see it. These tests reproduce the browser mechanics: render each sign-in form as its
 * page composes it, fill it, submit, let the busy state flush, then construct FormData
 * the way a browser does for a native submission and assert the values survived.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BusyForm } from "@/components/admin/BusyForm";

afterEach(() => cleanup());

function submitButton(form: HTMLFormElement): HTMLButtonElement {
  return form.querySelector('button[type="submit"]') as HTMLButtonElement;
}

describe("BusyForm native submission", () => {
  it("step 1: the email and next values survive the busy-state submit", () => {
    // Composed as v2/app/admin/sign-in/page.tsx composes it.
    render(
      <BusyForm action="/admin/sign-in/request" submitLabel="Email me a code" busyLabel="Sending…">
        <input type="hidden" name="next" value="/admin" />
        <label htmlFor="admin-email">Email</label>
        <input id="admin-email" name="email" type="email" required autoComplete="email" defaultValue="" />
      </BusyForm>,
    );
    const email = document.getElementById("admin-email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "dustin@hues.flowers" } });
    const form = email.closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    // Busy state has flushed (act); the browser builds the submission data now.
    expect(submitButton(form).textContent).toBe("Sending…");
    expect(submitButton(form).disabled).toBe(true);
    expect(email.disabled).toBe(false);
    const data = new FormData(form);
    expect(data.get("email")).toBe("dustin@hues.flowers");
    expect(data.get("next")).toBe("/admin");
  });

  it("step 2: the code and email values survive the busy-state submit", () => {
    // Composed as v2/app/admin/sign-in/code/page.tsx composes it.
    render(
      <BusyForm action="/admin/sign-in/verify" submitLabel="Verify" busyLabel="Verifying…">
        <input type="hidden" name="email" value="dustin@hues.flowers" />
        <input type="hidden" name="next" value="/admin" />
        <label htmlFor="admin-code">6-digit code</label>
        <input id="admin-code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} />
      </BusyForm>,
    );
    const code = document.getElementById("admin-code") as HTMLInputElement;
    fireEvent.change(code, { target: { value: "482916" } });
    const form = code.closest("form") as HTMLFormElement;
    fireEvent.submit(form);
    // Busy state has flushed (act); the browser builds the submission data now.
    expect(submitButton(form).textContent).toBe("Verifying…");
    expect(submitButton(form).disabled).toBe(true);
    expect(code.disabled).toBe(false);
    const data = new FormData(form);
    expect(data.get("code")).toBe("482916");
    expect(data.get("email")).toBe("dustin@hues.flowers");
    expect(data.get("next")).toBe("/admin");
  });
});

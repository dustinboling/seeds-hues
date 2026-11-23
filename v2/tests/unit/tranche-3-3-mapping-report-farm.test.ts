/**
 * Tranche 3.3 — report and farm multi-field mappings (COPY-3-3 §3.7 + §6): per-field messages
 * for every failing field at once, unknown_target on the Page address name field, the three
 * Add Your Farm gap closures, and raw detail never rendered (check 3.3-C). Fails on pre-build
 * code: reportFailure and farmFailure do not exist there.
 */
import { describe, expect, it } from "vitest";
import { REPORT_SUMMARY_HEADING, reportFailure } from "@/components/report/report-errors";
import { FARM_SUMMARY_HEADING, farmFailure } from "@/components/farm/farm-errors";

describe("3.3 — report multi-field mapping (COPY-3-3 §3.7)", () => {
  it("returns every failing field's message at once, not just the first", () => {
    const mapped = reportFailure(400, "validation_error", "message: Too small; contact: Invalid email address; target_ref: bad slug");
    expect(mapped).toEqual({
      fields: [
        { key: "message", message: "Please add a few words of detail (at least 5 characters, at most 4,000)." },
        { key: "contact", message: "Please enter a valid email address so we can reply." },
        { key: "target_ref", message: "Check the page address name — use the last part of the page’s URL, e.g. songbird-seed-co." },
      ],
      form: null,
    });
    expect(reportFailure(400, "validation_error", "type: Required; target_type: Required").fields.map((f) => f.key)).toEqual(["type", "target_type"]);
  });

  it("attaches unknown_target to the Page address name field and keeps the shared outcomes form-level", () => {
    expect(reportFailure(404, "unknown_target", "seller nope not found")).toEqual({
      fields: [{ key: "target_ref", message: "We couldn’t find a page with that address name. Check the seller or variety and the spelling, then try again." }],
      form: null,
    });
    expect(reportFailure(403, "turnstile_failed", "nope").form).toBe("The human check didn’t pass — please complete it and try again.");
    expect(reportFailure(429, "rate_limited", "nope").form).toBe("That’s a lot of requests in a short time — please wait a minute and try again.");
    expect(reportFailure(0, "network", "nope").form).toBe("Could not send. Check your connection and try again.");
    expect(reportFailure(500, "internal", "nope").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(reportFailure(400, "invalid_json", "body must be JSON").form).toBe("We couldn’t send your request. Please check the form and try again.");
    expect(REPORT_SUMMARY_HEADING).toBe("Some fields need attention before sending.");
  });
});

describe("3.3 — farm multi-field mapping + gap closures (COPY-3-3 §3.7 + §6)", () => {
  it("returns every failing field's message at once", () => {
    const mapped = farmFailure(400, "validation_error", "farm_name: Invalid input; city: Invalid input; business_phone: Invalid input");
    expect(mapped.fields).toEqual([
      { key: "farm_name", message: "Enter your farm’s name." },
      { key: "city", message: "Enter your farm’s city." },
      { key: "business_phone", message: "Enter your farm’s business phone as a 10-digit US number." },
    ]);
    expect(mapped.form).toBeNull();
  });

  it("maps invalid_state and invalid_phone to their fields", () => {
    expect(farmFailure(422, "invalid_state", "Choose the farm’s state from the list.")).toEqual({
      fields: [{ key: "state", message: "Choose your farm’s state from the list." }],
      form: null,
    });
    expect(farmFailure(422, "invalid_phone", "Enter the farm’s business phone as a 10-digit US number.")).toEqual({
      fields: [{ key: "business_phone", message: "Enter your farm’s business phone as a 10-digit US number." }],
      form: null,
    });
  });

  it("closes the three §6 gaps: ownership mapped, About both bounds, Varieties format sibling", () => {
    expect(farmFailure(403, "not_farm_owner", "This page is only for the verified owner of this farm.")).toEqual({
      fields: [],
      form: "This account isn’t the verified owner of your farm — sign in with the farm owner’s account, or submit your farm through Add Your Farm and we’ll verify it in review.",
    });
    expect(farmFailure(400, "validation_error", "about: tell us a little about the farm").fields).toEqual([
      { key: "about", message: "Tell us a little about your farm (at least 10 characters, at most 2,000)." },
    ]);
    expect(farmFailure(400, "validation_error", "about: Too big: expected string to have <=2000 characters").fields).toEqual([
      { key: "about", message: "Tell us a little about your farm (at least 10 characters, at most 2,000)." },
    ]);
    expect(farmFailure(400, "validation_error", "varieties: list at least one variety").fields).toEqual([
      { key: "varieties", message: "List at least one variety you want listed." },
    ]);
    expect(farmFailure(400, "validation_error", "varieties: Too big: expected string to have <=5000 characters").fields).toEqual([
      { key: "varieties", message: "List your varieties one per line." },
    ]);
    expect(FARM_SUMMARY_HEADING).toBe("Some fields need attention before sending for review.");
  });

  it("keeps shared outcomes form-level and never renders raw detail", () => {
    expect(farmFailure(0, "network", "nope").form).toBe("Could not send. Check your connection and try again.");
    expect(farmFailure(500, "internal", "nope").form).toBe("Something went wrong on our side. Please try again in a few minutes.");
    expect(farmFailure(400, "invalid_json", "body must be JSON").form).toBe("We couldn’t send your submission. Please check the form and try again.");
    for (const [s, c, d] of [
      [400, "validation_error", "website: enter a full web address starting with https://"],
      [403, "not_farm_owner", "This page is only for the verified owner of this farm."],
      [400, "invalid_json", "body must be JSON"],
    ] as const) {
      const mapped = farmFailure(s, c, d);
      for (const m of [...mapped.fields.map((f) => f.message), ...(mapped.form === null ? [] : [mapped.form])]) expect(m).not.toContain(d);
    }
  });
});

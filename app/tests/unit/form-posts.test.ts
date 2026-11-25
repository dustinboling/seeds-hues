/**
 * Slice 6: the form chassis' shared builders — one field mapping the SSR
 * floor POSTs and the enhanced JSON submits both use, so the two paths
 * carry identical payloads by construction (Step 2.1), plus the floor
 * outcome mapping (success states as v2 renders them; rejections mapped
 * to the plain-language failures with values preserved).
 */
import { describe, expect, it } from "vitest";
import {
  farmFloorOutcome,
  farmJsonFromForm,
  reportFloorOutcome,
  reportJsonFromForm,
} from "../../src/server/form-posts";

describe("reportJsonFromForm (floor fields → backend JSON, v2's mapping)", () => {
  const FIELDS = {
    type: "claim",
    target_type: "seller",
    target_ref: "Blue-Ridge-Seeds",
    message: "I run this farm.",
    contact: "  Willa@Example.com ",
  };

  it("normalizes exactly as the enhanced submit does", () => {
    expect(reportJsonFromForm(FIELDS)).toEqual({
      type: "claim",
      target_type: "seller",
      target_ref: "blue-ridge-seeds",
      message: "I run this farm.",
      contact: "Willa@Example.com",
    });
  });

  it("forwards a Turnstile token when one is present, omits it otherwise", () => {
    expect(reportJsonFromForm({ ...FIELDS, turnstile_token: "tok" })).toMatchObject({ turnstile_token: "tok" });
    expect(reportJsonFromForm(FIELDS)).not.toHaveProperty("turnstile_token");
    expect(reportJsonFromForm({ ...FIELDS, turnstile_token: "" })).not.toHaveProperty("turnstile_token");
  });

  it("never drops a typed field (the BusyForm lesson, structurally)", () => {
    const out = reportJsonFromForm(FIELDS);
    for (const key of ["type", "target_type", "target_ref", "message", "contact"]) {
      expect(out[key], key).toBeTruthy();
    }
  });
});

describe("farmJsonFromForm (floor fields → backend JSON, v2's mapping)", () => {
  const FIELDS = {
    farm_name: "  Songbird Seed Co ",
    contact_name: "Willa Gardener",
    contact_email: "willa@example.com",
    city: "Portland",
    state: "OR",
    website: "https://songbird.example.com",
    about: "A small farm.",
    varieties: "Zinnia — Queen Lime Blush",
    authorized: "on",
    business_phone: "(503) 555-0100",
    gbp_url: "",
    instagram_url: "https://instagram.com/songbird",
    tiktok_url: "",
    facebook_url: "",
    wholesale: "yes",
    notes: "Hello.",
  };

  it("trims strings, reads the checkbox as a boolean, passes wholesale through", () => {
    expect(farmJsonFromForm(FIELDS)).toEqual({
      farm_name: "Songbird Seed Co",
      contact_name: "Willa Gardener",
      contact_email: "willa@example.com",
      city: "Portland",
      state: "OR",
      website: "https://songbird.example.com",
      about: "A small farm.",
      varieties: "Zinnia — Queen Lime Blush",
      authorized: true,
      business_phone: "(503) 555-0100",
      gbp_url: "",
      instagram_url: "https://instagram.com/songbird",
      tiktok_url: "",
      facebook_url: "",
      wholesale: "yes",
      notes: "Hello.",
    });
  });

  it("reads an unchecked authorization as false and omits an empty token", () => {
    const { authorized: _drop, ...rest } = FIELDS;
    expect(farmJsonFromForm(rest).authorized).toBe(false);
    expect(farmJsonFromForm(FIELDS)).not.toHaveProperty("turnstile_token");
    expect(farmJsonFromForm({ ...FIELDS, turnstile_token: "tok" })).toMatchObject({ turnstile_token: "tok" });
  });

  it("never drops a typed field", () => {
    const out = farmJsonFromForm(FIELDS);
    for (const key of ["farm_name", "contact_name", "contact_email", "city", "state", "website", "about", "varieties", "business_phone"]) {
      expect(out[key], key).toBeTruthy();
    }
  });
});

describe("floor outcomes", () => {
  it("a 2xx report submission lands the v2 success state", () => {
    expect(
      reportFloorOutcome({ ok: true, status: 201, code: "", detail: "" }, { type: "claim", targetType: "seller", targetRef: "blue-ridge-seeds", message: "m", contact: "c" }),
    ).toEqual({ kind: "success", targetType: "seller", targetRef: "blue-ridge-seeds" });
  });

  it("a report rejection maps to plain copy with the values preserved", () => {
    const values = { type: "correct", targetType: "variety" as const, targetRef: "cosmos-lonely-bloom", message: "m", contact: "c" };
    const out = reportFloorOutcome({ ok: false, status: 400, code: "validation_error", detail: "target_ref: x; contact: y" }, values);
    expect(out.kind).toBe("failure");
    if (out.kind !== "failure") throw new Error("unreachable");
    expect(out.failure.fields).toHaveLength(2);
    expect(out.values).toEqual(values);
    const human = reportFloorOutcome({ ok: false, status: 403, code: "turnstile_failed", detail: "x" }, values);
    expect(human).toMatchObject({ kind: "failure", failure: { fields: [], form: "The human check didn’t pass — please complete it and try again." } });
  });

  it("farm outcomes mirror the report contract", () => {
    const values = { farm_name: "X", state: "OR", website: "not-a-url" } as Parameters<typeof farmFloorOutcome>[1];
    expect(farmFloorOutcome({ ok: true, status: 201, code: "", detail: "" }, values).kind).toBe("success");
    const out = farmFloorOutcome({ ok: false, status: 400, code: "validation_error", detail: "farm_name: x; website: y" }, values);
    expect(out.kind).toBe("failure");
    if (out.kind !== "failure") throw new Error("unreachable");
    expect(out.failure.fields.map((f) => f.key)).toEqual(["farm_name", "website"]);
    expect(out.values).toEqual(values);
  });
});

/**
 * Tranche 3.2 — the no-JS floor's redirect-back URL vocabulary (lib/waitlist-floor.ts): every
 * redirect carries the waitlist block's fragment (Ada Ruling 9, checks 3.2-E/3.2-G), error
 * redirects preserve the entered values and channel selection, and parsing degrades unknown
 * input to the resting floor instead of a broken state.
 */
import { describe, expect, it } from "vitest";
import { floorRedirect, joinErrorRedirect, parseFloorState, RESTING_FLOOR, WAITLIST_BLOCK_ID } from "@/lib/waitlist-floor";

describe("floor redirects always carry the block fragment (Ruling 9)", () => {
  it("verify / recognized / active redirects end with #waitlist-block", () => {
    for (const url of [
      floorRedirect("zinnia-dearest-tabita", { waitlist: "verify" }),
      floorRedirect("zinnia-dearest-tabita", { waitlist: "recognized", email: "a@example.com" }),
      floorRedirect("zinnia-dearest-tabita", { waitlist: "active", channels: "email" }),
    ]) {
      expect(url.endsWith(`#${WAITLIST_BLOCK_ID}`)).toBe(true);
      expect(url.startsWith("/variety/zinnia-dearest-tabita?")).toBe(true);
    }
  });

  it("error redirects preserve the entered values and channel selection", () => {
    const url = joinErrorRedirect("zinnia-dearest-tabita", ["email_invalid", "phone_invalid"], {
      email: "typed-value",
      channel: "sms",
      phone: "555",
    });
    expect(url.endsWith(`#${WAITLIST_BLOCK_ID}`)).toBe(true);
    expect(url).toContain("waitlist=error");
    expect(url).toContain("err=email_invalid%2Cphone_invalid");
    expect(url).toContain("email=typed-value");
    expect(url).toContain("channel=sms");
    expect(url).toContain("phone=555");
  });

  it("a garbage slug falls back to the site root instead of a broken page", () => {
    expect(floorRedirect("../../etc", { waitlist: "verify" })).toBe("/");
    expect(joinErrorRedirect("", ["email_invalid"], {})).toBe("/");
  });
});

describe("parseFloorState", () => {
  it("round-trips every redirect the endpoints build", () => {
    expect(parseFloorState({ waitlist: "verify" })).toEqual({ kind: "verify", codeError: null });
    expect(parseFloorState({ waitlist: "verify", cerr: "code_expired" })).toEqual({ kind: "verify", codeError: "code_expired" });
    expect(parseFloorState({ waitlist: "recognized", email: "a@example.com" })).toEqual({ kind: "recognized", email: "a@example.com", codeError: null });
    expect(parseFloorState({ waitlist: "active", channels: "email,sms" })).toEqual({ kind: "active", channels: ["email", "sms"], held: false });
    expect(parseFloorState({ waitlist: "active", held: "1" })).toEqual({ kind: "active", channels: [], held: true });
    expect(parseFloorState({ waitlist: "error", err: "email_invalid,phone_invalid", email: "e", channel: "sms", phone: "p" })).toEqual({
      kind: "error",
      errors: ["email_invalid", "phone_invalid"],
      email: "e",
      channel: "sms",
      phone: "p",
    });
  });

  it("unknown or incomplete values degrade to the resting floor", () => {
    expect(parseFloorState({})).toEqual(RESTING_FLOOR);
    expect(parseFloorState({ waitlist: "bogus" })).toEqual(RESTING_FLOOR);
    expect(parseFloorState({ waitlist: "recognized" })).toEqual(RESTING_FLOOR); // email required
    expect(parseFloorState({ waitlist: "recognized", email: "not-an-email" })).toEqual(RESTING_FLOOR);
    expect(parseFloorState({ waitlist: "error" })).toEqual(RESTING_FLOOR); // err required
    expect(parseFloorState({ waitlist: "error", err: "bogus" })).toEqual(RESTING_FLOOR);
    // Unknown codes are dropped, known ones kept.
    expect(parseFloorState({ waitlist: "error", err: "bogus,email_invalid", channel: "sms" })).toEqual({
      kind: "error",
      errors: ["email_invalid"],
      email: "",
      channel: "sms",
      phone: "",
    });
    expect(parseFloorState({ waitlist: "active", channels: "bogus" })).toEqual({ kind: "active", channels: [], held: false });
  });
});

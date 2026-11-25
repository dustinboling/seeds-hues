/**
 * Slice 6: the no-JS floor's redirect-back vocabulary, ported from
 * v2/lib/waitlist-floor.ts (pure strings — the service, the routes, and
 * the page share it). Every expectation is the v2 vocabulary, hardcoded.
 */
import { describe, expect, it } from "vitest";
import {
  activeFloorRedirect,
  floorRedirect,
  joinErrorRedirect,
  parseFloorState,
  RESTING_FLOOR,
  WAITLIST_BLOCK_ID,
} from "../../src/lib/waitlist-floor";

describe("waitlist floor vocabulary", () => {
  it("names the block's own element id (Ada Ruling 9's fragment target)", () => {
    expect(WAITLIST_BLOCK_ID).toBe("waitlist-block");
  });

  it("parses the verify floor with its optional code error", () => {
    expect(parseFloorState({ waitlist: "verify" })).toEqual({ kind: "verify", codeError: null });
    expect(parseFloorState({ waitlist: "verify", cerr: "code_incorrect" })).toEqual({ kind: "verify", codeError: "code_incorrect" });
    // Unknown code errors degrade to none — never a broken state.
    expect(parseFloorState({ waitlist: "verify", cerr: "bogus" })).toEqual({ kind: "verify", codeError: null });
  });

  it("parses the recognized floor only with a valid email", () => {
    expect(parseFloorState({ waitlist: "recognized", email: "willa@example.com" })).toEqual({
      kind: "recognized",
      email: "willa@example.com",
      codeError: null,
    });
    expect(parseFloorState({ waitlist: "recognized", email: "willa@example.com", cerr: "code_expired" })).toEqual({
      kind: "recognized",
      email: "willa@example.com",
      codeError: "code_expired",
    });
    expect(parseFloorState({ waitlist: "recognized", email: "not-an-email" })).toEqual(RESTING_FLOOR);
    expect(parseFloorState({ waitlist: "recognized" })).toEqual(RESTING_FLOOR);
  });

  it("parses the active floor with its channels and hold flag", () => {
    expect(parseFloorState({ waitlist: "active", channels: "email,sms" })).toEqual({ kind: "active", channels: ["email", "sms"], held: false });
    expect(parseFloorState({ waitlist: "active", held: "1" })).toEqual({ kind: "active", channels: [], held: true });
    expect(parseFloorState({ waitlist: "active", channels: "email,bogus" })).toEqual({ kind: "active", channels: ["email"], held: false });
  });

  it("parses the error floor with codes and preserved values", () => {
    expect(parseFloorState({ waitlist: "error", err: "email_invalid,phone_invalid", email: "bad", channel: "sms", phone: "123" })).toEqual({
      kind: "error",
      errors: ["email_invalid", "phone_invalid"],
      email: "bad",
      channel: "sms",
      phone: "123",
    });
    // Anything but exactly "sms" is the email channel; empty errors rest.
    expect(parseFloorState({ waitlist: "error", err: "rate_limited", email: "a@b.co" })).toEqual({
      kind: "error",
      errors: ["rate_limited"],
      email: "a@b.co",
      channel: "email",
      phone: "",
    });
    expect(parseFloorState({ waitlist: "error", err: "bogus" })).toEqual(RESTING_FLOOR);
    expect(parseFloorState({ waitlist: "error" })).toEqual(RESTING_FLOOR);
  });

  it("degrades unknown floor values to resting (a hand-typed URL never breaks)", () => {
    expect(parseFloorState({ waitlist: "bogus" })).toEqual(RESTING_FLOOR);
    expect(parseFloorState({})).toEqual(RESTING_FLOOR);
    expect(parseFloorState({ waitlist: ["verify", "active"] })).toEqual({ kind: "verify", codeError: null });
  });

  it("builds redirect-backs that always end with the block's fragment", () => {
    expect(floorRedirect("cosmos-lonely-bloom", { waitlist: "verify" })).toBe("/variety/cosmos-lonely-bloom?waitlist=verify#waitlist-block");
    expect(floorRedirect("cosmos-lonely-bloom", { waitlist: "recognized", email: "willa@example.com" })).toBe(
      "/variety/cosmos-lonely-bloom?waitlist=recognized&email=willa%40example.com#waitlist-block",
    );
    // A garbage slug has no page to land on: the site root, never stranded.
    expect(floorRedirect("BAD!!", { waitlist: "verify" })).toBe("/");
  });

  it("builds the active redirect with true channels, or the held flag when channelless", () => {
    expect(activeFloorRedirect("cosmos-lonely-bloom", ["email", "sms"])).toBe(
      "/variety/cosmos-lonely-bloom?waitlist=active&channels=email%2Csms#waitlist-block",
    );
    expect(activeFloorRedirect("cosmos-lonely-bloom", [])).toBe("/variety/cosmos-lonely-bloom?waitlist=active&held=1#waitlist-block");
    expect(activeFloorRedirect("cosmos-lonely-bloom", ["email", "pigeon"])).toBe(
      "/variety/cosmos-lonely-bloom?waitlist=active&channels=email#waitlist-block",
    );
  });

  it("builds the error redirect preserving entered values and channel selection", () => {
    expect(joinErrorRedirect("cosmos-lonely-bloom", ["email_invalid", "phone_invalid"], { email: "bad", channel: "sms", phone: "123" })).toBe(
      "/variety/cosmos-lonely-bloom?waitlist=error&err=email_invalid%2Cphone_invalid&email=bad&channel=sms&phone=123#waitlist-block",
    );
    expect(joinErrorRedirect("cosmos-lonely-bloom", ["rate_limited"], { email: "a@b.co" })).toBe(
      "/variety/cosmos-lonely-bloom?waitlist=error&err=rate_limited&email=a%40b.co&channel=email#waitlist-block",
    );
  });
});

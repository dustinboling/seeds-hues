/**
 * Slice 6: the app server's backend relay — pure helpers. The app Worker
 * serves pages and handlers itself and reverse-proxies the backend-owned
 * paths (the /api/* form/account reads and writes; the backend's /go/[id])
 * to the API origin. /go answers are rewritten on relay: the Bea m-3
 * utm_source rename and the brief's 410→404 mapping.
 */
import { describe, expect, it } from "vitest";
import { backendTarget, forwardHeaders, isGoId, mapGoStatus, rewriteGoLocation } from "../../src/server/api-relay";

describe("backendTarget", () => {
  it("joins the API origin to the backend-owned path + query", () => {
    expect(backendTarget("https://backend.example.net/api/v1", "/api/v1/account/me", "")).toBe("https://backend.example.net/api/v1/account/me");
    expect(backendTarget("https://backend.example.net/api/v1/", "/go/1", "")).toBe("https://backend.example.net/go/1");
    expect(backendTarget("http://127.0.0.1:9/api/v1", "/api/v1/unsubscribe", "?token=abc")).toBe("http://127.0.0.1:9/api/v1/unsubscribe?token=abc");
  });
});

describe("forwardHeaders", () => {
  it("forwards the browser context the backend reads, drops hop-by-hop + origin", () => {
    const incoming = new Headers({
      cookie: "sf_session=tok",
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
      referer: "https://seeds.hues.flowers/variety/x",
      "x-client": "web/1.0.0",
      "x-forwarded-for": "1.2.3.4",
      origin: "https://seeds.hues.flowers",
      host: "seeds.hues.flowers",
      connection: "keep-alive",
      "content-length": "12",
    });
    const out = forwardHeaders(incoming);
    expect(out.cookie).toBe("sf_session=tok");
    expect(out["content-type"]).toBe("application/json");
    expect(out["user-agent"]).toBe("Mozilla/5.0");
    expect(out.referer).toBe("https://seeds.hues.flowers/variety/x");
    expect(out["x-forwarded-for"]).toBe("1.2.3.4");
    expect(out).not.toHaveProperty("origin");
    expect(out).not.toHaveProperty("host");
    expect(out).not.toHaveProperty("connection");
    expect(out).not.toHaveProperty("content-length");
  });
});

describe("isGoId", () => {
  it("accepts numeric ids only (v2's route rule)", () => {
    expect(isGoId("1")).toBe(true);
    expect(isGoId("999")).toBe(true);
    for (const bad of ["abc", "1x", "", "-1", "1.5", "1/2", "1234567890123"]) expect(isGoId(bad), bad).toBe(false);
  });
});

describe("rewriteGoLocation (Bea m-3, applied on relay)", () => {
  it("renames the backend's retired utm_source to the current product name", () => {
    expect(rewriteGoLocation("https://shop.example.com/p?x=1&utm_source=seedfinder&utm_medium=referral")).toBe(
      "https://shop.example.com/p?x=1&utm_source=seed-directory&utm_medium=referral",
    );
  });

  it("keeps a seller's own utm_source (only ours is renamed)", () => {
    expect(rewriteGoLocation("https://shop.example.com/p?utm_source=newsletter&utm_medium=referral")).toBe(
      "https://shop.example.com/p?utm_source=newsletter&utm_medium=referral",
    );
  });
});

describe("mapGoStatus", () => {
  it("passes 302/404/410 through (gone stays gone, v2 + Bea §1.7), backend faults to 502", () => {
    expect(mapGoStatus(302)).toBe(302);
    expect(mapGoStatus(404)).toBe(404);
    // A removed seller's /go/ link 410s — the brief's unknown/removed-listing
    // 404 is the listing-level case; neither ever redirects.
    expect(mapGoStatus(410)).toBe(410);
    expect(mapGoStatus(500)).toBe(502);
  });
});

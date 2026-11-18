import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, pageMeta, parseLimit, readCursorPage } from "@/lib/api/pagination";
import { corsHeaders, etagMatches, jsonWithEtag } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { resetTokenBuckets, tokenBucketAllow } from "@/lib/api/rate-limit";
import { pathsForTag, RevalidateBodySchema, timingSafeEqual } from "@/lib/api/revalidate";

describe("pagination", () => {
  it("limit defaults to 24, clamps to 1–100, rejects non-numeric with 400", () => {
    expect(parseLimit(null)).toBe(24);
    expect(parseLimit("5")).toBe(5);
    expect(parseLimit("0")).toBe(1);
    expect(parseLimit("-3")).toBe(1);
    expect(parseLimit("1000")).toBe(100);
    expect(() => parseLimit("abc")).toThrow(ApiError);
    expect(() => parseLimit("5.5")).toThrow(/integer/);
  });

  it("cursor round-trips and is bound to its query", () => {
    const c = encodeCursor(48, "/api/v1/varieties?plant=sweet-pea");
    expect(decodeCursor(c, "/api/v1/varieties?plant=sweet-pea")).toBe(48);
    expect(() => decodeCursor(c, "/api/v1/varieties?plant=zinnia")).toThrow(/does not belong/);
    expect(() => decodeCursor("!!!", "/x")).toThrow(/malformed/);
    expect(() => decodeCursor(btoa(JSON.stringify({ o: -1, f: "x" })), "/x")).toThrow(/malformed/);
  });

  it("queryKey ignores cursor/limit and param order", () => {
    const a = readCursorPage(new URL("https://x/api/v1/varieties?plant=a&tag=b&limit=5"));
    const b = readCursorPage(new URL("https://x/api/v1/varieties?tag=b&plant=a"));
    expect(a.queryKey).toBe(b.queryKey);
  });

  it("nextCursor is null on the last page", () => {
    const page = { offset: 60, limit: 10, queryKey: "/q" };
    expect(pageMeta(page, 8, 68).nextCursor).toBeNull();
    expect(pageMeta({ ...page, offset: 0 }, 10, 68).nextCursor).not.toBeNull();
  });
});

describe("ETag + CORS", () => {
  it("returns 304 when If-None-Match matches", async () => {
    const first = await jsonWithEtag(new Request("https://x/a"), { a: 1 }, "no-store");
    const etag = first.headers.get("ETag")!;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    const second = await jsonWithEtag(new Request("https://x/a", { headers: { "If-None-Match": etag } }), { a: 1 }, "no-store");
    expect(second.status).toBe(304);
    expect(etagMatches(`W/${etag}, "zzz"`, etag)).toBe(true);
    expect(first.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(first.headers.get("X-API-Version")).toBe("1");
  });

  it("only reflects allowlisted origins, never *", () => {
    const allow = ["https://seeds.hues.flowers"];
    const ok = corsHeaders(new Request("https://x", { headers: { Origin: "https://seeds.hues.flowers" } }), allow);
    expect(ok["Access-Control-Allow-Origin"]).toBe("https://seeds.hues.flowers");
    const bad = corsHeaders(new Request("https://x", { headers: { Origin: "https://evil.example" } }), allow);
    expect(bad["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(Object.values(bad)).not.toContain("*");
  });
});

describe("rate limit fallback (per-isolate token bucket)", () => {
  it("allows 120 per minute per key, then refuses", () => {
    resetTokenBuckets();
    const now = 1_000_000;
    for (let i = 0; i < 120; i++) expect(tokenBucketAllow("1.2.3.4", now)).toBe(true);
    expect(tokenBucketAllow("1.2.3.4", now)).toBe(false);
    expect(tokenBucketAllow("5.6.7.8", now)).toBe(true);
    expect(tokenBucketAllow("1.2.3.4", now + 1000)).toBe(true); // refills 2/s
    resetTokenBuckets();
  });
});

describe("revalidation taxonomy", () => {
  it("maps tags to the pages that render them", () => {
    expect(pathsForTag("variety:stock-katz-mix")).toContain("/variety/stock-katz-mix");
    expect(pathsForTag("crop:zinnia")).toContain("/crop/zinnia");
    expect(pathsForTag("seller:floret")).toContain("/seller/floret");
    expect(pathsForTag("list:home")).toEqual(["/"]);
  });
  it("validates the body", () => {
    expect(RevalidateBodySchema.safeParse({}).success).toBe(false);
    expect(RevalidateBodySchema.safeParse({ tags: ["drop table"] }).success).toBe(false);
    expect(RevalidateBodySchema.safeParse({ paths: ["https://evil"] }).success).toBe(false);
    expect(RevalidateBodySchema.safeParse({ tags: ["variety:a-b"], paths: ["/variety"] }).success).toBe(true);
    expect(RevalidateBodySchema.safeParse({ tags: ["plant:a-b"] }).success).toBe(false);
  });
  it("compares tokens in constant time", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

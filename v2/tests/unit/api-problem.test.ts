/**
 * Direct tests for lib/api/problem.ts (refactor R2 §5): the RFC 9457
 * application/problem+json shape the delta route trees return. Pins current behavior.
 */
import { describe, expect, it } from "vitest";
import { Problem, problemBody, problemResponse } from "@/lib/api/problem";

describe("problemBody", () => {
  it("carries the RFC 9457 fields plus the stable code", () => {
    expect(problemBody(404, "not_found", "seller not found")).toEqual({
      type: "https://seeds.hues.flowers/api-docs#error-not_found",
      title: "Not Found",
      status: 404,
      detail: "seller not found",
      code: "not_found",
    });
  });

  it("titles the delta statuses, falling back to Error for unlisted ones", () => {
    expect(problemBody(400, "validation_error", "x").title).toBe("Bad Request");
    expect(problemBody(401, "unauthorized", "x").title).toBe("Unauthorized");
    expect(problemBody(422, "invalid_phone", "x").title).toBe("Unprocessable Content");
    expect(problemBody(429, "rate_limited", "x").title).toBe("Too Many Requests");
    expect(problemBody(418, "teapot", "x").title).toBe("Error");
  });
});

describe("problemResponse", () => {
  it("is application/problem+json, no-store, with the API headers", async () => {
    const res = problemResponse(404, "not_found", "seller not found");
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-API-Version")).toBe("1");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await res.json()).toEqual(problemBody(404, "not_found", "seller not found"));
  });

  it("merges extra headers (Retry-After, Allow, WWW-Authenticate)", async () => {
    const res = problemResponse(429, "rate_limited", "Too many requests", { "Retry-After": "60" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });
});

describe("Problem", () => {
  it("is an Error carrying status, code, detail and headers", () => {
    const p = new Problem(403, "insufficient_scope", "needs admin", { "WWW-Authenticate": "Bearer" });
    expect(p).toBeInstanceOf(Error);
    expect(p.name).toBe("Problem");
    expect(p.message).toBe("needs admin");
    expect(p.status).toBe(403);
    expect(p.code).toBe("insufficient_scope");
    expect(p.detail).toBe("needs admin");
    expect(p.headers).toEqual({ "WWW-Authenticate": "Bearer" });
    expect(new Problem(500, "internal", "x").headers).toEqual({});
  });
});

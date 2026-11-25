/**
 * Slice 8 error-monitoring suite (unit): the error-report builder
 * (src/lib/error-report.ts) — client + server error capture to the
 * configured sink with PII, price, and account data redacted and payloads
 * bounded. The build suite proves the /api/client-errors relay and the
 * server 5xx capture over the wire, including sink delivery.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import {
  ERROR_REPORT_MAX_BYTES,
  buildErrorReport,
  own500Html,
  postErrorReport,
  redactErrorData,
  redactErrorText,
} from "../../src/lib/error-report";

describe("redactErrorText", () => {
  it("redacts email addresses and phone-number shapes", () => {
    expect(redactErrorText("sign-in failed for willa@example.com")).toBe("sign-in failed for [email]");
    expect(redactErrorText("sms to +1 (503) 555-0114 bounced")).not.toContain("503");
    expect(redactErrorText("call 503-555-0114")).not.toContain("555-0114");
  });

  it("redacts tokens, secrets, and session cookies", () => {
    expect(redactErrorText("verify code=654321 expired")).not.toContain("654321");
    expect(redactErrorText("token abcdefghij1234567890 rejected")).not.toContain("abcdefghij1234567890");
    expect(redactErrorText("cookie sf_session=deadbeef42")).not.toContain("deadbeef42");
  });

  it("redacts price-shaped strings and leaves packet sizes alone", () => {
    expect(redactErrorText("total $4.95 at checkout")).not.toContain("$4.95");
    expect(redactErrorText("priceCents=350 in payload")).not.toContain("350");
    expect(redactErrorText("packets of 25 seeds")).toContain("25 seeds");
  });

  it("leaves ordinary stack-trace text intact", () => {
    const stack = "TypeError: Cannot read properties of null (reading 'slug')\n    at resolveVarietyRoute (/app/src/server/variety-route.ts:28:15)";
    expect(redactErrorText(stack)).toBe(stack);
  });
});

describe("redactErrorData", () => {
  it("redacts sensitive keys at any depth and bounds string length", () => {
    const out = redactErrorData({
      email: "willa@example.com",
      phone: "503-555-0114",
      nested: { turnstile_token: "tok", price: 4.95, ok: "variety-slug" },
      long: "x".repeat(10_000),
    }) as Record<string, unknown>;
    expect(out.email).toBe("[redacted]");
    expect(out.phone).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).turnstile_token).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).price).toBe("[redacted]");
    expect((out.nested as Record<string, unknown>).ok).toBe("variety-slug");
    expect(String(out.long).length).toBeLessThan(10_000);
  });

  it("survives cycles and non-plain values without throwing", () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(() => redactErrorData(cyclic)).not.toThrow();
    expect(() => redactErrorData(undefined)).not.toThrow();
    expect(redactErrorData(null)).toBeNull();
  });
});

describe("buildErrorReport", () => {
  it("builds a bounded report with the query stripped from the URL", () => {
    const report = buildErrorReport(
      { name: "TypeError", message: "boom for willa@example.com", stack: "at x\n".repeat(5000) },
      { url: "/account?code=654321&email=willa@example.com", userAgent: "Test/1.0" },
    );
    expect(report.name).toBe("TypeError");
    expect(report.message).not.toContain("willa@example.com");
    expect(report.url).toBe("/account");
    expect(report.userAgent).toBe("Test/1.0");
    expect(typeof report.timestamp).toBe("string");
    expect(JSON.stringify(report).length).toBeLessThanOrEqual(ERROR_REPORT_MAX_BYTES);
  });

  it("carries no price, account, or token data in any field", () => {
    const report = buildErrorReport(
      { name: "Error", message: "charged $4.95 to 503-555-0114", stack: "priceCents=350" },
      { url: "/seller/x", extra: { price: 1, session: "abc" } },
    );
    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/\$\d/);
    expect(blob).not.toContain("503-555-0114");
    expect(blob).not.toContain("350");
  });
});

describe("postErrorReport", () => {
  let sink: Server | null = null;
  const received: { headers: Record<string, string | undefined>; body: string }[] = [];

  afterAll(async () => {
    if (sink) await new Promise<void>((resolve, reject) => sink!.close((error) => (error ? reject(error) : resolve())));
  });

  async function sinkUrl(): Promise<string> {
    sink = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        received.push({
          headers: { "content-type": req.headers["content-type"] },
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(202, { "Content-Type": "text/plain" });
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => sink!.listen(0, "127.0.0.1", resolve));
    const address = sink.address();
    if (!address || typeof address === "string") throw new Error("sink: could not bind");
    return `http://127.0.0.1:${address.port}/errors`;
  }

  it("delivers the redacted report to the configured sink as JSON", async () => {
    const url = await sinkUrl();
    const report = buildErrorReport({ name: "Error", message: "hello willa@example.com" }, { url: "/x" });
    await expect(postErrorReport(url, report)).resolves.toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]!.headers["content-type"]).toContain("application/json");
    const delivered = JSON.parse(received[0]!.body) as { message: string };
    expect(delivered.message).toBe("hello [email]");
  });

  it("never throws when the sink is unreachable (returns false)", async () => {
    const report = buildErrorReport({ name: "Error", message: "x" }, { url: "/x" });
    await expect(postErrorReport("http://127.0.0.1:1/errors", report, { timeoutMs: 500 })).resolves.toBe(false);
  });
});

describe("own500Html", () => {
  it("serves the app's own 500 copy with a home link and noindex", () => {
    const html = own500Html();
    expect(html).toContain("<title>Something went wrong | seeds.hues.flowers</title>");
    expect(html).toContain("This page could not be loaded.");
    expect(html).toContain('href="/"');
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it("carries no price-shaped string", () => {
    expect(own500Html()).not.toMatch(/\$\d/);
    expect(own500Html().toLowerCase()).not.toContain("price");
  });
});

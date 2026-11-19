/**
 * /report human check (2026-11-19 fix): ReportForm uses the shared explicit-render <Turnstile>
 * widget (the implicit `.cf-turnstile` + inline api.js pattern never mounted in the React shell,
 * so the token was silently dropped and visitors saw "turnstile_token is required"), gates the
 * submit on the token state, and shows only human copy for API failures.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReportForm } from "@/components/report/ReportForm";
import { REPORT_NETWORK_ERROR, REPORT_TURNSTILE_FAILED, REPORT_TURNSTILE_PENDING, reportErrorMessage } from "@/components/report/report-errors";

const SITE_KEY = "1x00000000000000000000AA";
const render = (siteKey: string | null) =>
  renderToStaticMarkup(createElement(ReportForm, { type: "correct", targetType: "seller", targetRef: "songbird-seed-co", siteKey }));
const source = () => readFileSync(join(process.cwd(), "components/report/ReportForm.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("ReportForm human check", () => {
  it("renders the shared Turnstile widget, not the implicit cf-turnstile div or an inline script", () => {
    const h = render(SITE_KEY);
    expect(h).not.toMatch(/cf-turnstile"|class="cf-turnstile|data-sitekey/);
    expect(h).not.toMatch(/<script\b/);
    // The shared widget's explicit-render mount point, hidden token field and help note.
    expect(h).toMatch(/<div class="min-h-\[65px\]"><\/div>/);
    expect(h).toMatch(/<input type="hidden" name="cf-turnstile-response" value=""\/>/);
    expect(h).toMatch(/A quick check from Cloudflare confirms you’re a person/);
  });

  it("is wired like the sibling forms: token state, single-use reset, distinct action, token from state", () => {
    const src = source();
    expect(src).toMatch(/import \{ Turnstile \} from "@\/components\/ui\/Turnstile";/);
    expect(src).toMatch(/<Turnstile siteKey=\{props\.siteKey\} onToken=\{setToken\} resetKey=\{reset\} action="report" \/>/);
    expect(src).toMatch(/\.\.\.\(token \? \{ turnstile_token: token \} : \{\}\)/);
    expect(src).toMatch(/setReset\(\(n\) => n \+ 1\)/);
    // Never read from FormData (the field is empty until the widget completes), never send without a token.
    expect(src).not.toMatch(/cf-turnstile-response/);
    expect(src).toMatch(/if \(props\.siteKey && !token\) \{\s*setState\(\{ status: "error", message: REPORT_TURNSTILE_PENDING \}\);\s*return;/);
    // API failures go through the human-copy mapper, never the raw detail.
    expect(src).toMatch(/message: reportErrorMessage\(r\.status, r\.code, r\.message\)/);
    expect(src).not.toMatch(/\.detail\b/);
  });
});

describe("reportErrorMessage (human copy for /api/v1/reports failures)", () => {
  it("maps every Turnstile refusal to the human-check message", () => {
    expect(reportErrorMessage(400, "turnstile_required", "turnstile_token is required")).toBe(REPORT_TURNSTILE_FAILED);
    expect(reportErrorMessage(403, "turnstile_failed", "Turnstile verification failed")).toBe(REPORT_TURNSTILE_FAILED);
    expect(reportErrorMessage(400, "validation_error", "turnstile_token: Too big")).toBe(REPORT_TURNSTILE_FAILED);
    expect(REPORT_TURNSTILE_FAILED).toBe("The human check didn’t pass — please complete it and try again.");
    expect(REPORT_TURNSTILE_PENDING).toMatch(/human check hasn’t loaded yet/);
  });

  it("turns validator detail into plain field guidance", () => {
    expect(reportErrorMessage(400, "validation_error", "message: Too small: expected string to have >=5 characters")).toMatch(/at least 5 characters/);
    expect(reportErrorMessage(400, "validation_error", "contact: Invalid email address")).toMatch(/valid email address/);
    expect(reportErrorMessage(400, "validation_error", "target_ref: a variety or seller slug")).toMatch(/page address name/);
    expect(reportErrorMessage(400, "validation_error", "body: Unrecognized key")).toBe("Some of the details didn’t look right — please check the form and try again.");
  });

  it("covers the other outcomes without echoing raw detail", () => {
    expect(reportErrorMessage(404, "unknown_target", "seller nope not found")).toMatch(/couldn’t find a page with that address name/);
    expect(reportErrorMessage(429, "rate_limited", "Too many requests")).toMatch(/wait a minute/);
    expect(reportErrorMessage(500, "internal", "Internal error")).toMatch(/on our side/);
    expect(reportErrorMessage(0, "network", "Could not reach Seed Directory.")).toBe(REPORT_NETWORK_ERROR);
    expect(reportErrorMessage(400, "invalid_json", "body must be JSON")).toBe("We couldn’t send your request. Please check the form and try again.");
    for (const [s, c, d] of [
      [400, "turnstile_required", "turnstile_token is required"],
      [400, "validation_error", "message: Too small"],
      [404, "unknown_target", "seller nope not found"],
      [413, "payload_too_large", "body exceeds 65536 bytes"],
    ] as const) {
      expect(reportErrorMessage(s, c, d)).not.toContain(d);
    }
  });
});

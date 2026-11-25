/**
 * Slice 6 surface contract: drives the BUILT app (vike build + the Node
 * server entry, hermetic SEEDS_API_BASE stub playing the unchanged v2
 * backend) over plain HTTP with no JavaScript, Quinn-style. Every
 * expectation is hardcoded from the v2 sources and Bea's audit — never
 * computed by the app under test.
 *
 * Samples (tests/unit/forms-fixtures.ts): willa@example.com (full account
 * with a found-state waitlist entry on the zero-seller cosmos-lonely-bloom
 * + a waiting entry), phoneless@example.com (email only — the §11.1 seam),
 * go listing 1 (active) / 2 (removed) / 999 (unknown), and the signed
 * unsubscribe token pair. The unsubscribe flip runs LAST: it mutates the
 * stub's waitlist membership.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { fakeCatalogState } from "../unit/fake-catalog";
import type { FormsEndpointKey } from "../unit/forms-fixtures";
import { findPriceViolations } from "../unit/price-guard";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SITE = "https://seeds.hues.flowers";
const SECRET = "slice6-revalidate-secret";
const TURNSTILE_KEY = "test-site-key";

const decodeHtml = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const countOf = (html: string, pattern: RegExp): number => html.match(pattern)?.length ?? 0;

const meta = (html: string, attr: string, name: string): string | null => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? m[1]! : null;
};

const titleOf = (html: string): string | null => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1]! : null;
};

const canonicalOf = (html: string): string | null => {
  const m = html.match(/<link rel="canonical" href="([^"]*)"/);
  return m ? decodeHtml(m[1]!) : null;
};

let stub!: StubApi;
let server!: ChildProcess;
let BASE = "";

/** Minimal cookie jar across the app's relayed session flows. */
class Jar {
  private pairs = new Map<string, string>();
  store(res: Response): void {
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(";")[0]!;
      const eq = pair.indexOf("=");
      if (eq > 0) this.pairs.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  get header(): string | undefined {
    return this.pairs.size > 0 ? [...this.pairs].map(([k, v]) => `${k}=${v}`).join("; ") : undefined;
  }
}

interface FetchResult {
  status: number;
  headers: Headers;
  text: string;
  res: Response;
}

async function get(path: string, jar?: Jar, follow = true): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    redirect: follow ? "follow" : "manual",
    headers: jar?.header ? { Cookie: jar.header } : {},
  });
  jar?.store(res);
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

async function postForm(path: string, fields: Record<string, string>, jar?: Jar): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(jar?.header ? { Cookie: jar.header } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });
  jar?.store(res);
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

async function postJson(path: string, body: unknown, jar?: Jar): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...(jar?.header ? { Cookie: jar.header } : {}),
    },
    body: JSON.stringify(body),
  });
  jar?.store(res);
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

function runBuildStep(apiBase: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production", FORCE_COLOR: "0", SEEDS_API_BASE: apiBase },
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`npm run ${script} timed out:\n${output}`));
    }, 280_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} failed (code ${code}):\n${output}`));
    });
  });
}

function startServer(apiBase: string): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["dist-server/serve.mjs"], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: "0",
        SEEDS_API_BASE: apiBase,
        SEEDS_REVALIDATE_SECRET: SECRET,
        SEEDS_TURNSTILE_SITE_KEY: TURNSTILE_KEY,
      },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`server did not print its listening line in time. stderr:\n${stderr}`));
    }, 30_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = /listening on (http:\/\/\S+)/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        BASE = match[1]!;
        resolve(child);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      if (!BASE) {
        clearTimeout(timer);
        reject(new Error(`server exited before listening (code ${code}). stderr:\n${stderr}`));
      }
    });
  });
}

beforeAll(async () => {
  stub = await startStubApi(fakeCatalogState());
  const apiBase = `${stub.url}/api/v1`;
  await runBuildStep(apiBase, "build");
  await runBuildStep(apiBase, "build:server");
  server = await startServer(apiBase);
}, 290_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await stub?.close();
});

const MODE_KEYS: FormsEndpointKey[] = [
  "reports",
  "farm",
  "create",
  "signIn",
  "signInCode",
  "signInVerify",
  "waitlistJoin",
  "joinForm",
  "verifyForm",
  "waitlistVerify",
  "unsubscribe",
];

/** Every test starts from accept-everywhere; mode-mutating tests set theirs explicitly. */
beforeEach(() => {
  for (const key of MODE_KEYS) stub.state.forms.modes[key] = "accept";
});

const lastReceived = (endpoint: string): unknown[] => stub.state.forms.received.filter((r) => r.endpoint === endpoint).map((r) => r.body);

function expectNoPrice(html: string): void {
  expect(findPriceViolations(html)).toEqual([]);
}

function expectHeadExclusivity(html: string): void {
  expect(countOf(html, /<link rel="canonical"/g), "canonical count").toBe(1);
  expect(countOf(html, /<meta name="description"/g), "description count").toBe(1);
  expect(countOf(html, /<meta property="og:url"/g), "og:url count").toBe(1);
  expect(countOf(html, /<meta property="og:image"/g), "og:image count").toBe(1);
  expect(countOf(html, /<title>/g), "title count").toBe(1);
}

describe("/report SSR (raw HTML, no JavaScript)", () => {
  it("serves 200, no-store, noindex + follow, self-canonical", async () => {
    const res = await get("/report");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    // Form surfaces are never edge-cached as another user's state.
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = decodeHtml(res.text);
    expect(titleOf(html)).toBe("Report a problem, claim or remove a seller | seeds.hues.flowers");
    expect(meta(html, "name", "description")).toBe(
      "Correct a listing, claim your seller page, or ask us to remove it. Removals are honored within 48 hours.",
    );
    expect(canonicalOf(html)).toBe(`${SITE}/report`);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("renders the real floor form in the first HTML (no JS required to see or submit it)", async () => {
    const html = decodeHtml((await get("/report")).text);
    expect(html).toContain("Correct, claim or remove");
    expect(html).toContain("within 48 hours");
    expect(html).toContain('href="/about/data"');
    // A real form posting form-encoded to the page itself.
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/report"/);
    // The three intents v2 offers, the About select, and every field named.
    expect(html).toContain('value="correct"');
    expect(html).toContain('value="claim"');
    expect(html).toContain('value="remove"');
    expect(html).toContain('name="target_type"');
    expect(html).toContain('name="target_ref"');
    expect(html).toContain('name="message"');
    expect(html).toContain('name="contact"');
    expect(html).toContain("Send request");
    // The BusyForm lesson, structurally: no disabled fieldset or control in the floor form.
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
  });

  it("carries the Turnstile widget mount on the JS path", async () => {
    const html = decodeHtml((await get("/report")).text);
    expect(html).toContain('name="cf-turnstile-response"');
    expect(html).toContain("A quick check from Cloudflare confirms you’re a person.");
  });

  it("prefills type + target from the query (a seller wins for claim/remove)", async () => {
    const html = decodeHtml((await get("/report?type=claim&seller=blue-ridge-seeds&variety=cosmos-lonely-bloom")).text);
    expect(html).toMatch(/<input[^>]*value="claim"[^>]*checked|<input[^>]*checked[^>]*value="claim"/);
    expect(html).toContain('value="blue-ridge-seeds"');
    // A bogus type coerces to correct; invalid slugs are ignored, not errors.
    const fallback = decodeHtml((await get("/report?type=bogus&seller=BAD!!")).text);
    expect(fallback).toMatch(/<input[^>]*value="correct"[^>]*checked|<input[^>]*checked[^>]*value="correct"/);
    expect(fallback).not.toContain("BAD!!");
  });

  it("floor POST: a filled submission reaches the stub with every typed value intact + success state", async () => {
    const before = lastReceived("reports").length;
    // The token rides along to exercise the server's success render (a
    // no-JS browser cannot produce one — the JS widget supplies it there).
    const res = await postForm("/report", {
      type: "claim",
      target_type: "seller",
      target_ref: "Blue-Ridge-Seeds",
      message: "I run this farm and want to manage its listing, please.",
      contact: "Willa@Example.com",
      turnstile_token: "test-token",
    });
    expect(res.status).toBe(200);
    const bodies = lastReceived("reports");
    expect(bodies.length).toBe(before + 1);
    expect(bodies[bodies.length - 1]).toEqual({
      type: "claim",
      target_type: "seller",
      target_ref: "blue-ridge-seeds",
      message: "I run this farm and want to manage its listing, please.",
      contact: "Willa@Example.com",
      turnstile_token: "test-token",
    });
    const html = decodeHtml(res.text);
    expect(html).toContain("Thank you — your request is in our review queue. We reply by email.");
    expect(html).toContain('href="/seller/blue-ridge-seeds"');
  });

  it("floor POST rejection: plain-language errors AND the typed values preserved", async () => {
    stub.state.forms.modes.reports = "validation_error";
    const res = await postForm("/report", {
      type: "correct",
      target_type: "variety",
      target_ref: "cosmos-lonely-bloom",
      message: "The packet sizes look wrong here.",
      contact: "willa@example.com",
      turnstile_token: "test-token",
    });
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    // Tranche 1.5/3.3 wording, both fields (the summary-box path, entries ≥ 2).
    expect(html).toContain("Some fields need attention before sending.");
    expect(html).toContain("Check the page address name — use the last part of the page’s URL, e.g. songbird-seed-co.");
    expect(html).toContain("Please enter a valid email address so we can reply.");
    // Every typed value preserved.
    expect(html).toContain('value="cosmos-lonely-bloom"');
    expect(html).toContain("The packet sizes look wrong here.");
    expect(html).toContain('value="willa@example.com"');
  });

  it("floor POST without a token: the human-check error, values preserved (no-JS cannot pass Turnstile)", async () => {
    const res = await postForm("/report", {
      type: "remove",
      target_type: "seller",
      target_ref: "blue-ridge-seeds",
      message: "Please remove my farm.",
      contact: "willa@example.com",
    });
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("The human check didn’t pass — please complete it and try again.");
    expect(html).toContain('value="blue-ridge-seeds"');
    expect(html).toContain("Please remove my farm.");
  });

  it("JSON POSTs relay to the backend (the enhanced path's wire)", async () => {
    const ok = await postJson("/api/v1/reports", {
      type: "correct",
      target_type: "seller",
      target_ref: "blue-ridge-seeds",
      message: "A detail is wrong.",
      contact: "willa@example.com",
      turnstile_token: "test-token",
    });
    expect(ok.status).toBe(201);
    expect(JSON.parse(ok.text).data.status).toBe("open");
    // The server-verify round trip: no token, no submission.
    const refused = await postJson("/api/v1/reports", {
      type: "correct",
      target_type: "seller",
      target_ref: "blue-ridge-seeds",
      message: "A detail is wrong.",
      contact: "willa@example.com",
    });
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.text).code).toBe("turnstile_failed");
  });
});

describe("/add-your-farm SSR (raw HTML, no JavaScript)", () => {
  it("serves 200, no-store, indexable, self-canonical", async () => {
    const res = await get("/add-your-farm");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = decodeHtml(res.text);
    expect(titleOf(html)).toBe("Add Your Farm | seeds.hues.flowers");
    expect(meta(html, "name", "description")).toBe(
      "Sell flower seed in the US, from a farm or a seed company of any size? Add your seller to the Seed Directory — free, reviewed by hand, never pay-for-placement.",
    );
    expect(canonicalOf(html)).toBe(`${SITE}/add-your-farm`);
    expect(meta(html, "name", "robots")).toBe("index, follow");
    expect(html).not.toContain("noindex");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("renders the real floor form in the first HTML with the state options", async () => {
    const html = decodeHtml((await get("/add-your-farm")).text);
    expect(html).toContain("Add Your Farm");
    expect(html).toContain("reviewed by a person");
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/add-your-farm"/);
    for (const name of [
      "farm_name",
      "contact_name",
      "contact_email",
      "city",
      "state",
      "website",
      "about",
      "varieties",
      "authorized",
      "business_phone",
      "gbp_url",
      "instagram_url",
      "tiktok_url",
      "facebook_url",
      "wholesale",
      "notes",
    ]) {
      expect(html, `field ${name}`).toContain(`name="${name}"`);
    }
    // All US states in HTML (50 + DC + territories = the v2 list, pinned loosely).
    expect(countOf(html, /<option value="[A-Z]{2}">/g)).toBeGreaterThanOrEqual(50);
    expect(html).toContain("Choose a state");
    expect(html).toContain("Send for review");
    expect(html).toContain('name="cf-turnstile-response"');
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
  });

  it("prefills ?state= (case-insensitive) and ignores a bogus code", async () => {
    const html = decodeHtml((await get("/add-your-farm?state=or")).text);
    expect(html).toMatch(/<option value="OR" selected|<option value="OR"[^>]*selected/);
    const fallback = decodeHtml((await get("/add-your-farm?state=XX")).text);
    expect(fallback).not.toMatch(/<option value="[A-Z]{2}" selected/);
  });

  it("floor POST: a filled submission reaches the stub with every typed value intact + success state", async () => {
    const before = lastReceived("farm").length;
    const res = await postForm("/add-your-farm", {
      farm_name: "Songbird Seed Co",
      contact_name: "Willa Gardener",
      contact_email: "willa@example.com",
      city: "Portland",
      state: "OR",
      website: "https://songbird.example.com",
      about: "A small farm growing open-pollinated flower seed.",
      varieties: "Zinnia — Queen Lime Blush\nCosmos — Lonely Bloom",
      authorized: "on",
      business_phone: "(503) 555-0100",
      gbp_url: "",
      instagram_url: "https://instagram.com/songbird",
      tiktok_url: "",
      facebook_url: "",
      wholesale: "yes",
      notes: "We grow everything ourselves.",
      turnstile_token: "test-token",
    });
    expect(res.status).toBe(200);
    const bodies = lastReceived("farm");
    expect(bodies.length).toBe(before + 1);
    expect(bodies[bodies.length - 1]).toEqual({
      farm_name: "Songbird Seed Co",
      contact_name: "Willa Gardener",
      contact_email: "willa@example.com",
      city: "Portland",
      state: "OR",
      website: "https://songbird.example.com",
      about: "A small farm growing open-pollinated flower seed.",
      varieties: "Zinnia — Queen Lime Blush\nCosmos — Lonely Bloom",
      authorized: true,
      business_phone: "(503) 555-0100",
      gbp_url: "",
      instagram_url: "https://instagram.com/songbird",
      tiktok_url: "",
      facebook_url: "",
      wholesale: "yes",
      notes: "We grow everything ourselves.",
      turnstile_token: "test-token",
    });
    const html = decodeHtml(res.text);
    expect(html).toContain("Thank you — your submission is in our review queue.");
    expect(html).toContain("review every submission by hand");
  });

  it("floor POST rejection: plain-language errors AND the typed values preserved", async () => {
    stub.state.forms.modes.farm = "validation_error";
    const res = await postForm("/add-your-farm", {
      farm_name: "X",
      contact_name: "Willa Gardener",
      contact_email: "willa@example.com",
      city: "Portland",
      state: "OR",
      website: "not-a-url",
      about: "A small farm growing open-pollinated flower seed.",
      varieties: "Zinnia — Queen Lime Blush",
      authorized: "on",
      business_phone: "(503) 555-0100",
      turnstile_token: "test-token",
    });
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("Some fields need attention before sending for review.");
    expect(html).toContain("Enter your farm’s name.");
    expect(html).toContain("Enter your full website address starting with https:// — for example https://www.myfarm.com.");
    expect(html).toContain('value="X"');
    expect(html).toContain('value="not-a-url"');
    expect(html).toContain("Portland");
  });
});

describe("/account SPA shell (raw HTML, no JavaScript)", () => {
  it("serves 200, no-store, noindex + follow, with the signed-out frame only", async () => {
    const res = await get("/account");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = decodeHtml(res.text);
    expect(titleOf(html)).toBe("Your account | seeds.hues.flowers");
    expect(meta(html, "name", "description")).toBe(
      "Sign in or create a Seed Directory account to join waiting lists and get an alert when a variety is found.",
    );
    expect(canonicalOf(html)).toBe(`${SITE}/account`);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
    // The signed-out frame in full: no per-user content in the shell.
    expect(html).toContain("Your Seed Directory account");
    expect(html).toContain("New here? Create an account");
    expect(html).toContain("Already have one? Sign in");
    expect(html).not.toContain("Willa Gardener");
    expect(html).not.toContain("willa@example.com");
  });

  it("renders the sign-in panel with the §11.1 email-code seam, verbatim", async () => {
    const html = decodeHtml((await get("/account")).text);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="phone"');
    expect(html).toContain("Email me a code instead");
    expect(html).toContain("No phone number on your account? Emailing a code signs you in without one.");
    expect(html).toContain("Changed your phone number?");
  });

  it("renders the create-account fields and the deleted notice on ?deleted=1", async () => {
    const html = decodeHtml((await get("/account")).text);
    for (const name of ["name", "email", "phone", "zip", "account_type"]) {
      expect(html, `field ${name}`).toContain(`name="${name}"`);
    }
    expect(html).toContain("Create account");
    const deleted = decodeHtml((await get("/account?deleted=1")).text);
    expect(deleted).toContain("Your account and everything in it has been deleted.");
  });

  it("robots.txt disallows the account, unsubscribe, and go surfaces", async () => {
    const res = await get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Disallow: /account");
    expect(res.text).toContain("Disallow: /unsubscribe");
    expect(res.text).toContain("Disallow: /go/");
  });
});

describe("waitlist floor states on the zero-seller variety page", () => {
  const ZERO = "/variety/cosmos-lonely-bloom";

  it("the verify floor renders the plain code form, noindexed, canonical to the clean URL", async () => {
    const res = await get(`${ZERO}?waitlist=verify`);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(canonicalOf(html)).toBe(`${SITE}${ZERO}`);
    expect(html).toContain("Check your email for a code");
    expect(html).toContain("You're on the waiting list for Lonely Bloom.");
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/api\/v1\/account\/waitlist\/verify-form"/);
    expect(html).toContain('name="code"');
    expect(html).toContain("It works for 30 minutes.");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
  });

  it("the error floor renders the summary + inline errors with entered values preserved", async () => {
    const html = decodeHtml(
      (await get(`${ZERO}?waitlist=error&err=email_invalid,phone_invalid&email=bad&channel=sms&phone=123`)).text,
    );
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain("Some fields need attention before joining the waiting list.");
    expect(html).toContain("Enter a valid email address.");
    expect(html).toContain("Enter your phone number as a 10-digit US number.");
    expect(html).toContain('value="bad"');
    expect(html).toMatch(/<input[^>]*value="sms"[^>]*checked|<input[^>]*checked[^>]*value="sms"/);
    expect(html).toContain('value="123"');
  });

  it("the recognized floor names the submitter's own email with the code form", async () => {
    const html = decodeHtml((await get(`${ZERO}?waitlist=recognized&email=willa@example.com`)).text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toContain("This email already has an account — we've sent a 6-digit code to willa@example.com.");
    expect(html).toContain('name="email"');
    expect(html).toContain('value="willa@example.com"');
    expect(html).toContain("Use a different email");
  });

  it("the active floor states the channels, or the hold", async () => {
    const on = decodeHtml((await get(`${ZERO}?waitlist=active&channels=email,sms`)).text);
    expect(on).toContain("You’re on the waiting list for Lonely Bloom — glad to have you here.");
    expect(on).toContain("we’ll send you one alert by email and text — and that’s all.");
    const held = decodeHtml((await get(`${ZERO}?waitlist=active&held=1`)).text);
    expect(held).toContain("alerts are turned off for your account — turn them back on in your account.");
  });

  it("a bogus floor value degrades to the resting floor (still noindexed — transient state)", async () => {
    const html = decodeHtml((await get(`${ZERO}?waitlist=bogus`)).text);
    expect(meta(html, "name", "robots")).toBe("noindex, follow");
    expect(html).toMatch(/<form[^>]*method="post"[^>]*action="\/api\/v1\/account\/waitlist\/join-form"/);
    expect(html).toContain("Join the waiting list");
  });

  it("floor states bypass the edge cache: floor and clean renders never contaminate each other", async () => {
    const floor = decodeHtml((await get(`${ZERO}?waitlist=verify`)).text);
    expect(floor).toContain("Check your email for a code");
    const clean = decodeHtml((await get(ZERO)).text);
    expect(clean).toContain("Join the waiting list — we’ll let you know when a seller lists Lonely Bloom.");
    expect(meta(clean, "name", "robots")).toBe("index, follow");
    // And the reverse order: the clean 200 must not serve for the floor URL either.
    const floorAgain = decodeHtml((await get(`${ZERO}?waitlist=verify`)).text);
    expect(floorAgain).toContain("Check your email for a code");
    expect(meta(floorAgain, "name", "robots")).toBe("noindex, follow");
  });

  it("the internal /waitlist path 301s to the public URL (query intact), one hop", async () => {
    const res = await get(`${ZERO}/waitlist?waitlist=verify`, undefined, false);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${ZERO}?waitlist=verify`);
    const followed = await get(`${ZERO}?waitlist=verify`);
    expect(followed.status).toBe(200);
    expect(decodeHtml(followed.text)).toContain("Check your email for a code");
  });
});

describe("Turnstile posture: exempt floor, verified JS path", () => {
  it("the no-JS join-form stays exempt — no token, still a 303 (never a Turnstile demand)", async () => {
    const res = await postForm("/api/v1/account/waitlist/join-form", {
      variety: "cosmos-lonely-bloom",
      email: "exempt-floor@example.com",
      channel: "email",
      phone: "",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/variety/cosmos-lonely-bloom?waitlist=verify#waitlist-block");
    // Structural, not modal: even a turnstile_failed mode cannot make the floor ask for a token.
    stub.state.forms.modes.joinForm = "turnstile_failed";
    const again = await postForm("/api/v1/account/waitlist/join-form", {
      variety: "cosmos-lonely-bloom",
      email: "exempt-floor-2@example.com",
      channel: "email",
      phone: "",
    });
    expect(again.status).toBe(303);
    expect(again.headers.get("location")).toContain("#waitlist-block");
  });

  it("the floor-path abuse case is refused: rate limit trips a 303 error floor, values preserved", async () => {
    stub.state.forms.modes.joinForm = "rate_limited";
    const res = await postForm("/api/v1/account/waitlist/join-form", {
      variety: "cosmos-lonely-bloom",
      email: "abused@example.com",
      channel: "email",
      phone: "",
    });
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location).toContain("waitlist=error");
    expect(location).toContain("err=rate_limited");
    expect(location).toContain("#waitlist-block");
    const page = decodeHtml((await get(location.replace(/#.*$/, ""))).text);
    expect(page).toContain("That's a lot of requests in a short time — please wait a minute and try again.");
    expect(page).toContain('value="abused@example.com"');
  });

  it("genuine floor field errors redirect back with codes + preserved values (Ruling 9)", async () => {
    const res = await postForm("/api/v1/account/waitlist/join-form", {
      variety: "cosmos-lonely-bloom",
      email: "not-an-email",
      channel: "sms",
      phone: "123",
    });
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location).toContain("err=email_invalid%2Cphone_invalid");
    expect(location).toContain("#waitlist-block");
    const bodies = lastReceived("joinForm");
    expect(bodies[bodies.length - 1]).toEqual({
      variety: "cosmos-lonely-bloom",
      email: "not-an-email",
      channel: "sms",
      phone: "123",
    });
  });
});

describe("waitlist end-to-end (the U1 carry)", () => {
  const ZERO = "/variety/cosmos-lonely-bloom";

  it("signed-out no-JS: join → verify → joined-and-active, Ruling 9 fragment on every hop", async () => {
    const jar = new Jar();
    const email = "u1-fresh@example.com";
    const join = await postForm("/api/v1/account/waitlist/join-form", { variety: "cosmos-lonely-bloom", email, channel: "email", phone: "" }, jar);
    expect(join.status).toBe(303);
    expect(join.headers.get("location")).toBe(`${ZERO}?waitlist=verify#waitlist-block`);
    expect(join.headers.get("set-cookie")).toContain("sf_session=");
    const verifyPage = decodeHtml((await get(`${ZERO}?waitlist=verify`, jar)).text);
    expect(verifyPage).toContain("enter the 6-digit code from your email");
    const verify = await postForm("/api/v1/account/waitlist/verify-form", { variety: "cosmos-lonely-bloom", code: "123456" }, jar);
    expect(verify.status).toBe(303);
    const activeLocation = verify.headers.get("location")!;
    expect(activeLocation).toContain("waitlist=active");
    expect(activeLocation).toContain("#waitlist-block");
    const active = decodeHtml((await get(activeLocation.replace(/#.*$/, ""), jar)).text);
    expect(active).toContain("You’re on the waiting list for Lonely Bloom — glad to have you here.");
    // The backend truth: the join is recorded.
    expect(stub.state.forms.waitlists.some((e) => e.email === email && e.varietySlug === "cosmos-lonely-bloom")).toBe(true);
  });

  it("signed-in floor join: the variety page and /account both show the joined state", async () => {
    const jar = new Jar();
    const signIn = await postJson("/api/v1/account/sign-in", { email: "willa@example.com", phone: "(503) 555-0114", turnstile_token: "test-token" }, jar);
    expect(signIn.status).toBe(200);
    const join = await postForm("/api/v1/account/waitlist/join-form", { variety: "cosmos-lonely-bloom", email: "willa@example.com", channel: "email", phone: "" }, jar);
    expect(join.status).toBe(303);
    expect(join.headers.get("location")).toContain("waitlist=active");
    expect(join.headers.get("location")).toContain("#waitlist-block");
    const page = decodeHtml((await get(`${ZERO}?waitlist=active&channels=email,sms`, jar)).text);
    expect(page).toContain("we’ll send you one alert by email and text — and that’s all.");
    // /account's read behind the panel: the joined entry is there.
    const alerts = await get("/api/v1/account/alerts", jar);
    expect(alerts.status).toBe(200);
    const entries = JSON.parse(alerts.text).data as { variety: { slug: string }; status: { state: string } }[];
    expect(entries.some((e) => e.variety.slug === "cosmos-lonely-bloom")).toBe(true);
  });

  it("signed-out JSON join takes the account-creation path v2 ships and lands joined", async () => {
    const jar = new Jar();
    const email = "u1-json@example.com";
    const res = await postJson(
      "/api/v1/account",
      { email, sms_opt_in: false, join_variety: "cosmos-lonely-bloom", turnstile_token: "test-token" },
      jar,
    );
    expect(res.status).toBe(201);
    const data = JSON.parse(res.text).data;
    expect(data.waitlist).toMatchObject({ variety: "cosmos-lonely-bloom", joined: true, on_list: true });
    expect(res.headers.get("set-cookie")).toContain("sf_session=");
    expect(stub.state.forms.waitlists.some((e) => e.email === email && e.varietySlug === "cosmos-lonely-bloom")).toBe(true);
  });

  it("a recognized email joins inline (200, no session, pending join recorded)", async () => {
    const res = await postJson("/api/v1/account", {
      email: "willa@example.com",
      sms_opt_in: false,
      join_variety: "cosmos-lonely-bloom",
      turnstile_token: "test-token",
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.text).data).toMatchObject({ recognized: true, email: "willa@example.com" });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(stub.state.forms.pendingJoins["willa@example.com"]).toBe("cosmos-lonely-bloom");
  });
});

describe("/go/[id] handler", () => {
  it("active listing: 302 to the product URL with the port's UTM, click logged, §7.1 headers", async () => {
    const before = stub.state.forms.clicks.length;
    const res = await get("/go/1", undefined, false);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin + location.pathname).toBe("https://shop.example.com/blue-ridge/kings-ransom");
    // Bea m-3: the port ships the current product name, not the retired one.
    expect(location.searchParams.get("utm_source")).toBe("seed-directory");
    expect(location.searchParams.get("utm_medium")).toBe("referral");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("referrer-policy")).toBe("origin");
    expect(stub.state.forms.clicks.length).toBe(before + 1);
    expect(stub.state.forms.clicks[stub.state.forms.clicks.length - 1]).toMatchObject({ listingId: 1 });
  });

  it("keeps the target's own query; a present utm_source is never overwritten", async () => {
    const kept = new URL((await get("/go/3", undefined, false)).headers.get("location")!);
    expect(kept.searchParams.get("color")).toBe("red");
    expect(kept.searchParams.get("utm_source")).toBe("seed-directory");
    const sellersOwn = new URL((await get("/go/4", undefined, false)).headers.get("location")!);
    expect(sellersOwn.searchParams.get("utm_source")).toBe("newsletter");
    expect(sellersOwn.searchParams.get("utm_medium")).toBe("referral");
  });

  it("unknown, unpublished, and non-numeric ids 404 — never a redirect", async () => {
    for (const id of ["999", "7", "abc", "1x"]) {
      const res = await get(`/go/${id}`, undefined, false);
      expect(res.status, `/go/${id}`).toBe(404);
      expect(res.headers.get("location"), `/go/${id}`).toBeNull();
      expect(res.headers.get("x-robots-tag"), `/go/${id}`).toBe("noindex, nofollow");
    }
  });

  it("a removed listing 404s (the brief's mapping; the backend answers 410)", async () => {
    const res = await get("/go/2", undefined, false);
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("outbound shop links keep the nofollow/noopener posture", async () => {
    const html = (await get("/variety/sweet-pea-kings-ransom")).text;
    expect(html).toContain('rel="nofollow noopener');
    expect(html).toContain('href="/go/1"');
  });
});

// The unsubscribe flip mutates stub membership: it runs LAST.
describe("/unsubscribe utility", () => {
  const valid = () => stub.state.forms.unsubTokens.valid;
  const tampered = () => stub.state.forms.unsubTokens.tampered;

  it("a valid token renders the 200 confirm state — and the GET changes nothing", async () => {
    const entriesBefore = stub.state.forms.waitlists.length;
    const res = await get(`/unsubscribe?token=${encodeURIComponent(valid())}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = decodeHtml(res.text);
    expect(titleOf(html)).toBe("Unsubscribe | seeds.hues.flowers");
    expect(meta(html, "name", "description")).toBe("Stop Seed Directory waiting-list alerts for one variety or for everything.");
    expect(canonicalOf(html)).toBe(`${SITE}/unsubscribe`);
    expect(meta(html, "name", "robots")).toBe("noindex, nofollow");
    expectHeadExclusivity(res.text);
    expectNoPrice(res.text);
    expect(html).toContain("Leave the waiting list for");
    expect(html).toContain("Lonely Bloom");
    expect(html).toContain("Leave this waiting list");
    expect(stub.state.forms.waitlists.length).toBe(entriesBefore);
  });

  it("confirming flips the subscription in the stub", async () => {
    const res = await postJson(`/api/v1/unsubscribe?token=${encodeURIComponent(valid())}`, {});
    expect(res.status).toBe(200);
    expect(JSON.parse(res.text).data).toMatchObject({ kind: "variety", done: true });
    expect(stub.state.forms.waitlists.some((e) => e.varietySlug === "cosmos-lonely-bloom" && e.email === "willa@example.com")).toBe(false);
    expect(stub.state.forms.unsubscribed).toContain(valid());
  });

  it("a tampered token GETs the invalid-link state — no state change", async () => {
    const entriesBefore = stub.state.forms.waitlists.length;
    const res = await get(`/unsubscribe?token=${encodeURIComponent(tampered())}`);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("This unsubscribe link isn’t valid.");
    expect(html).toContain('href="/account"');
    expect(stub.state.forms.waitlists.length).toBe(entriesBefore);
  });

  it("a tampered token POST is refused with 4xx — no state change", async () => {
    const entriesBefore = stub.state.forms.waitlists.length;
    const res = await postJson(`/api/v1/unsubscribe?token=${encodeURIComponent(tampered())}`, {});
    expect(res.status).toBe(400);
    expect(JSON.parse(res.text).code).toBe("invalid_token");
    expect(stub.state.forms.waitlists.length).toBe(entriesBefore);
    // An unsigned unsubscribe mutates nothing.
    const bare = await postJson("/api/v1/unsubscribe", {});
    expect(bare.status).toBe(400);
    expect(stub.state.forms.waitlists.length).toBe(entriesBefore);
  });
});

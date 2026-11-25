/**
 * Slice 7 surface contract: drives the BUILT app (vike build + the Node
 * server entry, hermetic SEEDS_API_BASE stub playing the unchanged v2
 * backend's admin layer) over plain HTTP with no JavaScript,
 * Quinn-style. Every expectation is hardcoded from the v2 admin sources —
 * never computed by the app under test.
 *
 * Sessions (tests/unit/admin-fixtures.ts): Dustin (admin),
 * admin-session-token-7a; Ruth (reviewer), reviewer-session-token-7b;
 * Willa (visitor, unauthorized), visitor-session-token-7c; signed-out (no
 * cookie); aged-admin-session-7d (6.5 days old, still valid — no idle
 * timeout); expired-admin-session-7e (absolute 7-day expiry only).
 *
 * State hygiene: admin mutations persist in the stub AND the app's caches
 * (data cache + edge mock). beforeEach resets the stub state
 * (resetAdminState) and purges the app caches for every touched path via
 * /internal/revalidate, so each test starts from exact fixture values.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { fakeCatalogState, resetAdminState } from "../unit/fake-catalog";
import type { AdminEndpointKey } from "../unit/admin-fixtures";
import { findPriceViolations } from "../unit/price-guard";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SECRET = "slice7-revalidate-secret";

const ADMIN = "sf_admin_session=admin-session-token-7a";
const REVIEWER = "sf_admin_session=reviewer-session-token-7b";
const VISITOR = "sf_admin_session=visitor-session-token-7c";
const AGED = "sf_admin_session=aged-admin-session-7d";
const EXPIRED = "sf_admin_session=expired-admin-session-7e";

const NOTE_MARKERS = ["NOTE-BLUERIDGE-7A", "NOTE-PRAIRIE-7B"];

const decodeHtml = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const meta = (html: string, attr: string, name: string): string | null => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? m[1]! : null;
};

let stub!: StubApi;
let server!: ChildProcess;
let BASE = "";

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

async function get(path: string, cookie?: string, follow = true): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    redirect: follow ? "follow" : "manual",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

async function getJar(path: string, jar: Jar, follow = true): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    redirect: follow ? "follow" : "manual",
    headers: jar.header ? { Cookie: jar.header } : {},
  });
  jar.store(res);
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

async function postForm(path: string, fields: Record<string, string>, cookie?: string): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

async function postFormJar(path: string, fields: Record<string, string>, jar: Jar): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(jar.header ? { Cookie: jar.header } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });
  jar.store(res);
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

async function postJson(path: string, body: unknown, cookie?: string): Promise<FetchResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, text: await res.text(), res };
}

const jsonOf = (res: FetchResult): Record<string, unknown> => JSON.parse(res.text) as Record<string, unknown>;

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
      env: { ...process.env, PORT: "0", SEEDS_API_BASE: apiBase, SEEDS_REVALIDATE_SECRET: SECRET },
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

const MODE_KEYS: AdminEndpointKey[] = ["decide", "sellerActions", "varietyActions", "listingActions", "accountActions", "signInRequest", "signInVerify"];

beforeEach(async () => {
  resetAdminState(stub.state);
  for (const key of MODE_KEYS) stub.state.admin.modes[key] = "accept";
  // Purge the app's caches for every publicly touched path (the stub is
  // pristine again; the app must not serve a previous test's render).
  await fetch(`${BASE}/internal/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ tags: ["variety:cosmos-lonely-bloom", "variety:sweet-pea-kings-ransom", "seller:blue-ridge-seeds", "seller:prairie-seed-house"] }),
  });
});

function expectNoPrice(html: string): void {
  expect(findPriceViolations(html)).toEqual([]);
}

function expectNoPriceMarkers(text: string): void {
  for (const marker of Object.values(stub.state.admin.internalPrices)) {
    expect(text).not.toContain(marker);
  }
  expect(text).not.toMatch(/"price|"lowPrice|"priceCents/);
}

describe("auth gate: every /admin/* surface refuses signed-out + unauthorized", () => {
  const surfaces = ["/admin", "/admin/review", "/admin/sellers", "/admin/varieties", "/admin/listings", "/admin/accounts", "/admin/statistics", "/admin/more"];

  it("signed-out lands on sign-in with the return path preserved", async () => {
    for (const surface of surfaces) {
      const res = await get(surface, undefined, false);
      expect(res.status, surface).toBe(303);
      const location = res.headers.get("location") ?? "";
      expect(location, surface).toContain("/admin/sign-in");
      expect(location, surface).toContain(`next=${encodeURIComponent(surface)}`);
      expect(res.text, `${surface} leaks`).not.toContain("NOTE-BLUERIDGE-7A");
    }
  });

  it("a deep signed-out URL preserves its full return path", async () => {
    const res = await get("/admin/review?queue=listings", undefined, false);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/sign-in?next=%2Fadmin%2Freview%3Fqueue%3Dlistings");
  });

  it("signed-in-but-unauthorized lands on no-access with no admin data", async () => {
    for (const surface of surfaces) {
      const res = await get(surface, VISITOR, false);
      expect(res.status, surface).toBe(303);
      expect(res.headers.get("location"), surface).toBe("/admin/no-access");
    }
    const body = await get("/admin/sellers", VISITOR);
    expect(body.text).not.toContain("NOTE-BLUERIDGE-7A");
    expect(body.text).not.toContain("Blue Ridge Seeds");
  });

  it("an expired session lands on sign-in with the A3 welcome-back + email prefill", async () => {
    const res = await get("/admin/review", EXPIRED, false);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/admin/sign-in");
    expect(location).toContain("expired=1");
    expect(location).toContain(`email=${encodeURIComponent("dustin@hues.flowers")}`);
  });

  it("the aged session (6.5 days) still opens every surface — no idle timeout", async () => {
    for (const surface of surfaces) {
      if (surface === "/admin/accounts") continue;
      const res = await get(surface, AGED);
      expect(res.status, surface).toBe(200);
    }
  });

  it("admin surfaces are no-store + noindex, nofollow", async () => {
    for (const surface of ["/admin/sign-in", "/admin", "/admin/review", "/admin/sellers"]) {
      const res = await get(surface, surface === "/admin/sign-in" ? undefined : ADMIN);
      expect(res.status, surface).toBe(200);
      expect(res.headers.get("cache-control"), surface).toBe("no-store");
      expect(meta(res.text, "name", "robots"), surface).toBe("noindex, nofollow");
    }
  });
});

describe("no-access landing", () => {
  it("a privileged session that strays here goes home", async () => {
    const res = await get("/admin/no-access", ADMIN, false);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin");
  });

  it("a bare visit signs in first", async () => {
    const res = await get("/admin/no-access", undefined, false);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/sign-in");
  });

  it("an unauthorized account sees the landing with no admin data", async () => {
    const res = await get("/admin/no-access?email=willa%40example.com&name=Willa+Gardener");
    expect(res.status).toBe(200);
    expect(decodeHtml(res.text)).toContain("This is the admin section");
    expect(decodeHtml(res.text)).toContain("Willa Gardener (willa@example.com)");
    expect(res.text).not.toContain("NOTE-BLUERIDGE-7A");
    expect(res.text).not.toContain("Blue Ridge Seeds");
  });
});

describe("sign-in drive (email → code → session, stub-backed)", () => {
  it("the email step renders the v2 flow card", async () => {
    const res = await get("/admin/sign-in");
    expect(res.status).toBe(200);
    expect(decodeHtml(res.text)).toContain("Admin sign-in");
    expect(res.text).toContain('action="/admin/sign-in/request"');
    expect(res.text).toContain('id="admin-email"');
  });

  it("a live session skips the flow to the return path", async () => {
    const res = await get("/admin/sign-in?next=%2Fadmin%2Freview", ADMIN, false);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/admin/review");
  });

  it("full flow by form: request → code step → verify → hub, then sign-out", async () => {
    const jar = new Jar();
    const requested = await postFormJar("/admin/sign-in/request", { email: "ruth@example.com", next: "/admin" }, jar);
    expect(requested.status).toBe(303);
    expect(requested.headers.get("location")).toBe("/admin/sign-in/code?email=ruth%40example.com&next=%2Fadmin");
    expect(stub.state.admin.issuedCodes["ruth@example.com"]).toBe("222222");

    const code = await getJar("/admin/sign-in/code?email=ruth%40example.com&next=%2Fadmin", jar);
    expect(code.status).toBe(200);
    expect(decodeHtml(code.text)).toContain("Enter your code");
    expect(decodeHtml(code.text)).toContain("It works for 30 minutes.");

    const verified = await postFormJar("/admin/sign-in/verify", { email: "ruth@example.com", code: "222222", next: "/admin" }, jar);
    expect(verified.status).toBe(303);
    expect(verified.headers.get("location")).toBe("/admin");
    const setCookie = verified.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sf_admin_session=");
    expect(setCookie).toContain("Path=/admin");
    expect(setCookie).toContain("Max-Age=604800");

    const hub = await getJar("/admin", jar);
    expect(hub.status).toBe(200);
    expect(decodeHtml(hub.text)).toContain("Admin home");

    const out = await postFormJar("/admin/sign-in/sign-out", {}, jar);
    expect(out.status).toBe(303);
    expect(out.headers.get("location")).toBe("/admin/sign-in?signedout=1");
    const after = await getJar("/admin", jar, false);
    expect(after.status).toBe(303);
  });

  it("a visitor's correct code lands on no-access with no session", async () => {
    const jar = new Jar();
    await postFormJar("/admin/sign-in/request", { email: "willa@example.com", next: "/admin" }, jar);
    const verified = await postFormJar("/admin/sign-in/verify", { email: "willa@example.com", code: "333333", next: "/admin" }, jar);
    expect(verified.status).toBe(303);
    expect((verified.headers.get("location") ?? "").startsWith("/admin/no-access")).toBe(true);
    expect(verified.headers.get("set-cookie")).toBeNull();
  });

  it("a wrong code returns to the code step with the designed state", async () => {
    const res = await postForm("/admin/sign-in/verify", { email: "ruth@example.com", code: "000000", next: "/admin" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("error=code_incorrect");
  });

  it("the JSON branch (the SPA's wire): request + verify", async () => {
    const requested = await postJson("/admin/sign-in/request", { email: "dustin@hues.flowers", next: "/admin/statistics" });
    expect(requested.status).toBe(200);
    expect(jsonOf(requested)).toMatchObject({ ok: true });
    expect(String(jsonOf(requested).redirect)).toContain("/admin/sign-in/code");
    const verified = await postJson("/admin/sign-in/verify", { email: "dustin@hues.flowers", code: "111111", next: "/admin/statistics" });
    expect(verified.status).toBe(200);
    expect(jsonOf(verified)).toMatchObject({ ok: true, redirect: "/admin/statistics" });
    expect(verified.headers.get("set-cookie") ?? "").toContain("sf_admin_session=");
    const wrong = await postJson("/admin/sign-in/verify", { email: "dustin@hues.flowers", code: "000000", next: "/admin" });
    expect(wrong.status).toBe(400);
    expect(jsonOf(wrong)).toMatchObject({ ok: false });
  });
});

describe("hub shell (signed-in SPA frame, data loads client-side)", () => {
  it("renders the dashboard frame with the viewer and no queue data in HTML", async () => {
    const res = await get("/admin", ADMIN);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("Admin home");
    expect(html).toContain("Needs a decision");
    expect(html).toContain("How the site is doing");
    expect(html).toContain("Dustin");
    // Client-rendered: the decisions/wanteds/notes are API reads, not SSR.
    expect(res.text).not.toContain("Lonely Bloom");
    expect(res.text).not.toContain("NOTE-BLUERIDGE-7A");
    expect(meta(res.text, "name", "robots")).toBe("noindex, nofollow");
    expectNoPrice(res.text);
  });

  it("the hub API read carries cards + snapshot (reviewer identical)", async () => {
    for (const cookie of [ADMIN, REVIEWER]) {
      const res = await get("/api/internal/admin/home", cookie);
      expect(res.status, cookie).toBe(200);
      const body = jsonOf(res).data as { cards: { key: string; count: number }[]; totalWaiting: number; wanted: unknown[]; snapshot: { cards: { key: string }[] } };
      expect(body.cards.map((c) => [c.key, c.count])).toEqual([
        ["duplicates", 1],
        ["sellers", 2],
        ["listings", 1],
        ["reports", 3],
      ]);
      expect(body.totalWaiting).toBe(7);
      expect(body.wanted).toHaveLength(3);
      expect(body.snapshot.cards.map((c) => c.key)).toEqual(["visitors", "accounts", "waitlist", "clicks"]);
    }
  });
});

describe("role drives through the app handlers", () => {
  it("reviewer: duplicate-hold decision completes", async () => {
    const res = await postJson("/admin/review/decide", { action: "mark_duplicate", kind: "review", id: 103, queue: "duplicates" }, REVIEWER);
    expect(res.status).toBe(200);
    expect(jsonOf(res)).toMatchObject({ ok: true });
    expect(String(jsonOf(res).redirect)).toContain("status=duplicate_kept");
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("merged");
    // The held name stays an alternate name on the existing variety.
    expect(stub.state.details["sweet-pea-kings-ransom"]!.aliases).toContain("King's Ransom Select");
  });

  it("reviewer: correction approval applies the fix immediately (public too)", async () => {
    const res = await postJson("/admin/review/decide", { action: "apply_correction", kind: "review", id: 102, queue: "reports" }, REVIEWER);
    expect(res.status).toBe(200);
    expect(String(jsonOf(res).redirect)).toContain("status=correction_applied");
    const admin = await get("/api/internal/admin/sellers/prairie-seed-house", REVIEWER);
    expect((jsonOf(admin).data as { location: string }).location).toBe("Eudora, KS");
    const pub = await get("/api/v1/sellers/prairie-seed-house");
    expect(((jsonOf(pub).data ?? {}) as { location: string }).location).toBe("Eudora, KS");
  });

  it("reviewer: note add completes with the reviewer author trail", async () => {
    const res = await postJson("/admin/sellers/actions", { action: "add_note", seller: "geoseed", body: "Ruth was here — recheck in spring." }, REVIEWER);
    expect(res.status).toBe(200);
    expect(jsonOf(res)).toMatchObject({ ok: true });
    const detail = await get("/api/internal/admin/sellers/geoseed", REVIEWER);
    const notes = (jsonOf(detail).data as { notes: { body: string; authorName: string; authorRole: string }[] }).notes;
    expect(notes).toContainEqual({ id: 3, authorName: "Ruth Reviewer", authorRole: "reviewer", body: "Ruth was here — recheck in spring.", createdAt: stub.state.admin.now });
  });

  it("reviewer: variety-remove is refused at the handler with no state change", async () => {
    const res = await postJson("/admin/varieties/actions", { action: "variety_remove", variety: "cosmos-lonely-bloom" }, REVIEWER);
    expect(res.status).toBe(403);
    expect(jsonOf(res)).toMatchObject({ ok: false });
    expect(stub.state.admin.varieties.find((v) => v.slug === "cosmos-lonely-bloom")!.deletedAt).toBeNull();
  });

  it("reviewer: role_save is refused at the handler with no state change", async () => {
    const res = await postJson("/admin/accounts/actions", { action: "role_save", account: 3, role: "reviewer" }, REVIEWER);
    expect(res.status).toBe(403);
    expect(stub.state.admin.accounts.find((a) => a.id === 3)!.role).toBe("visitor");
  });

  it("reviewer: /admin/accounts renders the reviewer-accounts landing, never data", async () => {
    const res = await get("/admin/accounts", REVIEWER);
    expect(res.status).toBe(200);
    expect(decodeHtml(res.text)).toContain("Account settings");
    expect(res.text).not.toContain("willa@example.com");
  });

  it("admin: variety-remove completes on the listing-free variety; the public page then 404s", async () => {
    const res = await postJson("/admin/varieties/actions", { action: "variety_remove", variety: "cosmos-lonely-bloom" }, ADMIN);
    expect(res.status).toBe(200);
    expect(String(jsonOf(res).redirect)).toContain("status=variety_removed");
    // The handler purged the caches: the public surface 404s on refetch.
    const page = await get("/variety/cosmos-lonely-bloom");
    expect(page.status).toBe(404);
    const api = await get("/api/v1/varieties/cosmos-lonely-bloom");
    expect(api.status).toBe(404);
  });

  it("admin: variety-remove on the listed variety is refused naming the count", async () => {
    const res = await postJson("/admin/varieties/actions", { action: "variety_remove", variety: "sweet-pea-kings-ransom" }, ADMIN);
    expect(res.status).toBe(409);
    expect(decodeHtml(String(jsonOf(res).message))).toContain("3 live listings");
    expect(stub.state.admin.varieties.find((v) => v.slug === "sweet-pea-kings-ransom")!.deletedAt).toBeNull();
  });

  it("admin: form POST publish lands back with the published status + public listing", async () => {
    const res = await postForm("/admin/review/decide", { action: "publish_listing", kind: "review", id: "101", queue: "listings", show: "25", variety_name: "Lonely Bloom" }, ADMIN);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("status=published");
    const pub = await get("/api/v1/varieties/cosmos-lonely-bloom");
    expect(pub.status).toBe(200);
    expect((((jsonOf(pub).data ?? {}) as { listings: { id: number }[] }).listings ?? []).map((l) => l.id)).toContain(900);
  });
});

describe("duplicate holds are decidable ONLY through the UI path", () => {
  it("the key API refuses approve AND reject on the hold (Dustin's ruling)", async () => {
    for (const verb of ["approve", "reject"]) {
      const res = await fetch(`${BASE}/api/v1/admin/review/103/${verb}`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", "x-admin-key": "test-admin-key-7" },
        body: JSON.stringify({}),
      });
      expect(res.status, verb).toBe(422);
      expect((await res.json()) as unknown).toMatchObject({ code: "duplicate_hold_ui_only" });
    }
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("pending");
  });

  it("a generic decide action cannot resolve the hold either", async () => {
    const res = await postJson("/admin/review/decide", { action: "publish_listing", kind: "review", id: 103 }, ADMIN);
    expect(res.status).toBe(422);
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("pending");
  });
});

describe("notes-leak drive (public absent, admin present)", () => {
  it("the public shop payloads carry the real shop but NO internal-note text", async () => {
    for (const slug of ["blue-ridge-seeds", "prairie-seed-house"]) {
      const res = await get(`/api/v1/sellers/${slug}`);
      expect(res.status, slug).toBe(200);
      // The payload is real (contact block + locations render from it).
      expect(res.text, slug).toContain("customerServicePhone");
      expect(res.text, slug).toContain("locations");
      for (const marker of NOTE_MARKERS) expect(res.text, `${slug} leaks`).not.toContain(marker);
      expect(res.text, slug).not.toContain("internal");
    }
  });

  it("the public variety payloads carry NO internal-note text", async () => {
    const res = await get("/api/v1/varieties/sweet-pea-kings-ransom");
    expect(res.status).toBe(200);
    for (const marker of NOTE_MARKERS) expect(res.text).not.toContain(marker);
  });

  it("the admin sellers surface shows the notes to BOTH roles", async () => {
    for (const cookie of [ADMIN, REVIEWER]) {
      const res = await get("/api/internal/admin/sellers/blue-ridge-seeds", cookie);
      expect(res.status, cookie).toBe(200);
      expect(res.text, cookie).toContain("NOTE-BLUERIDGE-7A");
    }
  });
});

describe("review flows through the app handlers", () => {
  it("dismissing the false-queue item resolves it with the reason kept", async () => {
    const res = await postJson("/admin/review/decide", { action: "dismiss_report", kind: "review", id: 104, queue: "reports", reason_select: "Other", reason_note: "The listing is live." }, ADMIN);
    expect(res.status).toBe(200);
    expect(String(jsonOf(res).redirect)).toContain("status=report_dismissed");
    const item = stub.state.admin.review.find((i) => i.id === 104)!;
    expect(item.status).toBe("rejected");
    expect(item.reason).toBe("Other — The listing is live.");
  });

  it("not-a-duplicate adds the held name as its own variety", async () => {
    const res = await postJson("/admin/review/decide", { action: "add_hold_variety", kind: "review", id: 103, queue: "duplicates" }, ADMIN);
    expect(res.status).toBe(200);
    expect(String(jsonOf(res).redirect)).toContain("status=variety_added");
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("approved");
    expect(stub.state.admin.varieties.map((v) => v.name)).toContain("King's Ransom Select");
  });

  it("skip leaves the hold waiting", async () => {
    const res = await postJson("/admin/review/decide", { action: "skip_hold", kind: "review", id: 103, queue: "duplicates" }, ADMIN);
    expect(res.status).toBe(200);
    expect(String(jsonOf(res).redirect)).toContain("status=hold_skipped");
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("pending");
  });

  it("admin removal-apply resolves; the reviewer is refused pre-effect", async () => {
    const refused = await postJson("/admin/review/decide", { action: "apply_removal", kind: "review", id: 105 }, REVIEWER);
    expect(refused.status).toBe(403);
    expect(stub.state.admin.review.find((i) => i.id === 105)!.status).toBe("pending");
    const res = await postJson("/admin/review/decide", { action: "apply_removal", kind: "review", id: 105 }, ADMIN);
    expect(res.status).toBe(200);
    expect(stub.state.admin.review.find((i) => i.id === 105)!.status).toBe("approved");
  });
});

describe("remove flows through the app handlers", () => {
  it("listing retire is idempotent (second call a no-op success)", async () => {
    const first = await postJson("/admin/listings/actions", { action: "retire", listing: 501, reason: "Dead link" }, ADMIN);
    expect(first.status).toBe(200);
    expect(jsonOf(first)).toMatchObject({ ok: true });
    const historyLength = stub.state.admin.listings.find((l) => l.id === 501)!.history.length;
    const second = await postJson("/admin/listings/actions", { action: "retire", listing: 501, reason: "Dead link" }, ADMIN);
    expect(second.status).toBe(200);
    expect(jsonOf(second)).toMatchObject({ ok: true });
    expect(stub.state.admin.listings.find((l) => l.id === 501)!.history.length).toBe(historyLength);
  });

  it("retire without a reason is refused; restore round-trips", async () => {
    const noReason = await postJson("/admin/listings/actions", { action: "retire", listing: 501 }, ADMIN);
    expect(noReason.status).toBe(422);
    expect(stub.state.admin.listings.find((l) => l.id === 501)!.status).toBe("active");
    const restored = await postJson("/admin/listings/actions", { action: "restore", listing: 502 }, ADMIN);
    expect(restored.status).toBe(200);
    expect(stub.state.admin.listings.find((l) => l.id === 502)!.status).toBe("published");
    const skipped = await postJson("/admin/listings/actions", { action: "restore", listing: 501 }, ADMIN);
    expect(skipped.status).toBe(200);
  });

  it("accounts: role_save + farm grant/revoke with the guardrails", async () => {
    const changed = await postJson("/admin/accounts/actions", { action: "role_save", account: 3, role: "reviewer" }, ADMIN);
    expect(changed.status).toBe(200);
    expect(stub.state.admin.accounts.find((a) => a.id === 3)!.role).toBe("reviewer");
    const self = await postJson("/admin/accounts/actions", { action: "role_save", account: 1, role: "reviewer" }, ADMIN);
    expect(self.status).toBe(403);
    expect(jsonOf(self)).toMatchObject({ ok: false });
    const granted = await postJson("/admin/accounts/actions", { action: "farm_grant", account: 3, seller: "geoseed" }, ADMIN);
    expect(granted.status).toBe(200);
    expect(stub.state.admin.accounts.find((a) => a.id === 3)!.isFarmOwner).toBe(true);
    const revoked = await postJson("/admin/accounts/actions", { action: "farm_revoke", account: 3 }, ADMIN);
    expect(revoked.status).toBe(200);
    expect(stub.state.admin.accounts.find((a) => a.id === 3)!.isFarmOwner).toBe(false);
  });
});

describe("statistics through the app (four signals + Visitors card)", () => {
  it("views rank Candy Stripe 1 / King's Ransom 2 / Lonely Bloom 3", async () => {
    const res = await get("/api/internal/admin/statistics/popularity?signal=views", ADMIN);
    expect(res.status).toBe(200);
    const rows = (jsonOf(res).data as { rows: { slug: string; value: number; movement: { text: string } }[] }).rows;
    expect(rows.map((r) => [r.slug, r.value, r.movement.text])).toEqual([
      ["cosmos-candy-stripe", 120, "▲ 1"],
      ["sweet-pea-kings-ransom", 90, "▼ 1"],
      ["cosmos-lonely-bloom", 60, "—"],
    ]);
  });

  it("clicks order differently and exclude bots; waitlist is range-free; searches carry finds", async () => {
    const clicks = await get("/api/internal/admin/statistics/popularity?signal=clicks", ADMIN);
    const clickRows = (jsonOf(clicks).data as { rows: { slug: string; value: number }[] }).rows;
    expect(clickRows.map((r) => [r.slug, r.value])).toEqual([
      ["cosmos-lonely-bloom", 40],
      ["cosmos-candy-stripe", 25],
      ["sweet-pea-kings-ransom", 10],
    ]);
    for (const range of ["7d", "30d", "12w"]) {
      const waitlist = await get(`/api/internal/admin/statistics/popularity?range=${range}&signal=waitlist`, ADMIN);
      const rows = (jsonOf(waitlist).data as { rows: { slug: string; waiters: number }[] }).rows;
      expect(rows.map((r) => [r.slug, r.waiters]), range).toEqual([
        ["cosmos-lonely-bloom", 7],
        ["cosmos-mystery-bloom", 5],
        ["sweet-pea-kings-ransom", 2],
      ]);
    }
    const searches = await get("/api/internal/admin/statistics/popularity?signal=searches", ADMIN);
    const body = jsonOf(searches).data as { top: unknown[]; noResults: unknown[] };
    expect(body.top).toHaveLength(3);
    expect(body.noResults).toEqual([{ term: "xyz-no-match", count: 5 }]);
  });

  it("the overview Visitors card is dark in v2's shape", async () => {
    const res = await get("/api/internal/admin/statistics/overview", ADMIN);
    expect(res.status).toBe(200);
    const cards = (jsonOf(res).data as { cards: Record<string, unknown>[] }).cards;
    expect(cards[0]).toMatchObject({ key: "visitors", label: "Visitors", total: null, error: false });
    expect(cards[0]!.noData).toBe("Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.");
  });

  it("the statistics shell renders headings with no numbers in HTML", async () => {
    const res = await get("/admin/statistics", ADMIN);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("Statistics");
    expect(html).toContain("Variety popularity");
    expect(res.text).not.toContain("NOTE-BLUERIDGE-7A");
    expectNoPrice(res.text);
  });
});

describe("BusyForm at the wire: payloads arrive intact, rejections change nothing", () => {
  it("every action payload the app forwards arrives verbatim at the stub", async () => {
    const sends: [string, Record<string, unknown>, string][] = [
      ["/admin/review/decide", { action: "publish_listing", kind: "review", id: 101, queue: "listings" }, ADMIN],
      ["/admin/sellers/actions", { action: "add_note", seller: "geoseed", body: "Wire  intact — keep." }, ADMIN],
      ["/admin/sellers/actions", { action: "edit_save", seller: "geoseed", location: "Greenwood, SC" }, ADMIN],
      ["/admin/varieties/actions", { action: "alias_add", variety: "cosmos-lonely-bloom", name: "Lonely Bloom Select" }, ADMIN],
      ["/admin/listings/actions", { action: "retire", listing: 501, reason: "Dead link", note: "Gone." }, ADMIN],
      ["/admin/accounts/actions", { action: "role_save", account: 3, role: "reviewer" }, ADMIN],
    ];
    for (const [path, body, cookie] of sends) {
      const res = await postJson(path, body, cookie);
      expect(res.status, path).toBe(200);
    }
    const received = stub.state.admin.received;
    expect(received).toHaveLength(6);
    expect(received[0]!.body).toEqual({ action: "publish_listing", kind: "review", id: 101, queue: "listings" });
    expect(received[1]!.body).toEqual({ action: "add_note", seller: "geoseed", body: "Wire  intact — keep." });
    expect(received[2]!.body).toEqual({ action: "edit_save", seller: "geoseed", location: "Greenwood, SC" });
    expect(received[3]!.body).toEqual({ action: "alias_add", variety: "cosmos-lonely-bloom", name: "Lonely Bloom Select" });
    expect(received[4]!.body).toEqual({ action: "retire", listing: 501, reason: "Dead link", note: "Gone." });
    expect(received[5]!.body).toEqual({ action: "role_save", account: 3, role: "reviewer" });
  });

  it("a rejecting endpoint refuses AFTER recording (values preserved server-side)", async () => {
    stub.state.admin.modes.sellerActions = "reject";
    const res = await postJson("/admin/sellers/actions", { action: "add_note", seller: "geoseed", body: "Kept through rejection." }, ADMIN);
    expect(res.status).toBe(422);
    expect(jsonOf(res)).toMatchObject({ ok: false });
    const last = stub.state.admin.received[stub.state.admin.received.length - 1]!;
    expect(last.body).toEqual({ action: "add_note", seller: "geoseed", body: "Kept through rejection." });
    expect(stub.state.admin.sellers.find((s) => s.slug === "geoseed")!.notes).toHaveLength(0);
  });
});

describe("no price anywhere (admin surfaces + payloads)", () => {
  it("every admin shell greps clean", async () => {
    const shells: [string, string | undefined][] = [
      ["/admin/sign-in", undefined],
      ["/admin/sign-in/code?email=ruth%40example.com&next=%2Fadmin", undefined],
      ["/admin/no-access?email=willa%40example.com", undefined],
      ["/admin", ADMIN],
      ["/admin/review", ADMIN],
      ["/admin/sellers", ADMIN],
      ["/admin/varieties", ADMIN],
      ["/admin/listings", ADMIN],
      ["/admin/accounts", ADMIN],
      ["/admin/statistics", ADMIN],
      ["/admin/more", ADMIN],
    ];
    expect(Object.keys(stub.state.admin.internalPrices).length).toBeGreaterThan(0);
    for (const [path, cookie] of shells) {
      const res = await get(path, cookie);
      expect(res.status, path).toBe(200);
      expectNoPrice(res.text);
      expectNoPriceMarkers(res.text);
      expect(res.text, path).not.toMatch(/\$\d/);
    }
  });

  it("every admin JSON read greps clean", async () => {
    const paths = [
      "/api/internal/admin/home",
      "/api/internal/admin/review/queue?queue=listings",
      "/api/internal/admin/review/detail?kind=review&id=101",
      "/api/internal/admin/sellers",
      "/api/internal/admin/sellers/blue-ridge-seeds",
      "/api/internal/admin/varieties",
      "/api/internal/admin/varieties/sweet-pea-kings-ransom",
      "/api/internal/admin/listings",
      "/api/internal/admin/listings/501",
      "/api/internal/admin/accounts",
      "/api/internal/admin/accounts/3",
      "/api/internal/admin/statistics/overview",
      "/api/internal/admin/statistics/popularity?signal=views",
    ];
    for (const path of paths) {
      const res = await get(path, ADMIN);
      expect(res.status, path).toBe(200);
      expectNoPriceMarkers(res.text);
    }
  });
});

describe("waitlist (retired) + more + handler misc", () => {
  it("/admin/waitlist is a true 404 — retired in v2 Slice D, faithfully absent", async () => {
    const res = await get("/admin/waitlist", ADMIN);
    expect(res.status).toBe(404);
  });

  it("/admin/more renders links + identity + sign-out", async () => {
    const res = await get("/admin/more", ADMIN);
    expect(res.status).toBe(200);
    const html = decodeHtml(res.text);
    expect(html).toContain("More");
    expect(html).toContain("Dustin");
    expect(res.text).toContain('action="/admin/sign-in/sign-out"');
  });

  it("a mismatched Origin is refused on every admin POST", async () => {
    for (const path of ["/admin/review/decide", "/admin/sellers/actions", "/admin/sign-in/request"]) {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example.com", Cookie: ADMIN },
        body: JSON.stringify({}),
      });
      expect(res.status, path).toBe(403);
    }
  });

  it("signed-out action POSTs redirect to sign-in (form) or 401 JSON", async () => {
    const form = await postForm("/admin/review/decide", { action: "skip_hold", kind: "review", id: "103" });
    expect(form.status).toBe(303);
    expect(form.headers.get("location")).toContain("/admin/sign-in");
    const json = await postJson("/admin/review/decide", { action: "skip_hold", kind: "review", id: 103 });
    expect(json.status).toBe(401);
    expect(jsonOf(json)).toMatchObject({ ok: false, code: "signed_out" });
  });

  it("unknown actions are refused without state change", async () => {
    const res = await postJson("/admin/sellers/actions", { action: "explode", seller: "geoseed" }, ADMIN);
    expect(res.status).toBe(400);
    expect(jsonOf(res)).toMatchObject({ ok: false });
  });
});

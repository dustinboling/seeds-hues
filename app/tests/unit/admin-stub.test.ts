/**
 * Slice 7 stub contract: the test backend's admin layer behaves like the
 * unchanged v2 admin services — sessions (absolute 7-day expiry, NO idle
 * timeout), role enforcement on every call (403 pre-effect, never
 * UI-only), review/seller/variety/listing/account effects, statistics,
 * the duplicate-hold key-API refusal, and the verbatim payload log with
 * per-endpoint accept/reject modes. The app suites drive the APP against
 * this stub; this suite pins the STUB itself so a green app suite rests
 * on a faithful backend.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { fakeCatalogState, resetAdminState } from "./fake-catalog";

let stub!: StubApi;
let BASE = "";

const ADMIN = "sf_admin_session=admin-session-token-7a";
const REVIEWER = "sf_admin_session=reviewer-session-token-7b";
const VISITOR = "sf_admin_session=visitor-session-token-7c";
const AGED = "sf_admin_session=aged-admin-session-7d";
const EXPIRED = "sf_admin_session=expired-admin-session-7e";

async function get(path: string, cookie?: string): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown>, headers: res.headers };
}

async function post(path: string, body: unknown, cookie?: string, key = false): Promise<{ status: number; json: Record<string, unknown>; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(key ? { "x-admin-key": "test-admin-key-7" } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown>, headers: res.headers };
}

const data = (json: Record<string, unknown>): Record<string, unknown> => json.data as Record<string, unknown>;

beforeAll(async () => {
  stub = await startStubApi(fakeCatalogState());
  BASE = stub.url;
});

afterAll(async () => {
  await stub?.close();
});

beforeEach(() => {
  resetAdminState(stub.state);
});

describe("admin sessions (fixture i)", () => {
  it("me resolves the admin, reviewer, and visitor sessions", async () => {
    expect(data((await get("/api/internal/admin/me", ADMIN)).json)).toMatchObject({ signed_in: true, user: { email: "dustin@hues.flowers", role: "admin" } });
    expect(data((await get("/api/internal/admin/me", REVIEWER)).json)).toMatchObject({ signed_in: true, user: { email: "ruth@example.com", role: "reviewer" } });
    expect(data((await get("/api/internal/admin/me", VISITOR)).json)).toMatchObject({ signed_in: true, user: { email: "willa@example.com", role: "visitor" } });
  });

  it("signed-out me reports signed_in false with no user", async () => {
    const res = await get("/api/internal/admin/me");
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ signed_in: false });
  });

  it("the AGED session (6.5 days old) is still valid — no idle timeout exists", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await get("/api/internal/admin/me", AGED);
      expect(res.status).toBe(200);
      expect(data(res.json)).toMatchObject({ signed_in: true, user: { role: "admin" } });
    }
    const queue = await get("/api/internal/admin/review/queue?queue=listings", AGED);
    expect(queue.status).toBe(200);
    expect(data(queue.json)).toMatchObject({ total: 1 });
  });

  it("session fixtures carry no idle-timeout fields at all", () => {
    for (const session of stub.state.admin.sessions) {
      const keys = Object.keys(session).join(",");
      expect(keys).not.toMatch(/idle|lastSeen|last_seen|touch/i);
      expect(Object.keys(session).sort()).toEqual(["createdAt", "email", "expiresAt", "token"]);
    }
  });

  it("the EXPIRED session is refused, with the welcome-back email", async () => {
    const res = await get("/api/internal/admin/me", EXPIRED);
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ signed_in: false, expired: true, email: "dustin@hues.flowers" });
    const queue = await get("/api/internal/admin/review/queue?queue=listings", EXPIRED);
    expect(queue.status).toBe(401);
  });

  it("sign-in completes: request → verify → session cookie → me", async () => {
    const requested = await post("/api/internal/admin/sign-in/request", { email: "ruth@example.com" });
    expect(requested.status).toBe(200);
    expect(data(requested.json)).toEqual({ delivery: "sent" });
    const verified = await post("/api/internal/admin/sign-in/verify", { email: "ruth@example.com", code: "222222" });
    expect(verified.status).toBe(200);
    const setCookie = verified.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("sf_admin_session=");
    expect(setCookie).toContain("Path=/admin");
    expect(setCookie).toContain("Max-Age=604800");
    const token = setCookie.split(";")[0]!;
    const me = await get("/api/internal/admin/me", token);
    expect(data(me.json)).toMatchObject({ signed_in: true, user: { role: "reviewer" } });
  });

  it("unknown emails advance identically (no account enumeration)", async () => {
    const res = await post("/api/internal/admin/sign-in/request", { email: "nobody@example.com" });
    expect(res.status).toBe(200);
    expect(data(res.json)).toEqual({ delivery: "sent" });
    expect(stub.state.admin.issuedCodes["nobody@example.com"]).toBeUndefined();
  });

  it("a correct code for a visitor account is refused with no session", async () => {
    await post("/api/internal/admin/sign-in/request", { email: "willa@example.com" });
    const res = await post("/api/internal/admin/sign-in/verify", { email: "willa@example.com", code: "333333" });
    expect(res.status).toBe(403);
    expect(res.json).toMatchObject({ code: "no_role" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("a wrong code is refused and issues no session", async () => {
    const before = stub.state.admin.sessions.length;
    const res = await post("/api/internal/admin/sign-in/verify", { email: "ruth@example.com", code: "000000" });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ code: "code_incorrect" });
    expect(stub.state.admin.sessions.length).toBe(before);
  });

  it("sign-out revokes the session", async () => {
    const out = await post("/api/internal/admin/sign-out", {}, ADMIN);
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie") ?? "").toContain("Max-Age=0");
    const me = await get("/api/internal/admin/me", ADMIN);
    expect(me.json.data).toEqual({ signed_in: false });
  });
});

describe("role discrimination at the API (not just the UI)", () => {
  it("the reviewer decides a duplicate hold", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "mark_duplicate", kind: "review", id: 103 }, REVIEWER);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "duplicate_kept", existing: "King's Ransom" });
  });

  it("the reviewer approves a structured correction AND the fix applies immediately", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "apply_correction", kind: "review", id: 102 }, REVIEWER);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "correction_applied", seller: "prairie-seed-house", applied: ["location", "region"] });
    const seller = stub.state.admin.sellers.find((s) => s.slug === "prairie-seed-house")!;
    expect(seller.location).toBe("Eudora, KS");
    expect(seller.region).toBe("KS");
  });

  it("the reviewer reads and adds internal notes", async () => {
    const detail = await get("/api/internal/admin/sellers/blue-ridge-seeds", REVIEWER);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(data(detail.json))).toContain("NOTE-BLUERIDGE-7A");
    const added = await post("/api/internal/admin/sellers/actions", { action: "add_note", seller: "blue-ridge-seeds", body: "Reviewer note 7." }, REVIEWER);
    expect(added.status).toBe(200);
    expect(data(added.json)).toMatchObject({ status: "note_added" });
  });

  it("the reviewer is refused variety-remove at the API with no state change", async () => {
    const res = await post("/api/internal/admin/varieties/actions", { action: "variety_remove", variety: "cosmos-lonely-bloom" }, REVIEWER);
    expect(res.status).toBe(403);
    expect(stub.state.admin.varieties.find((v) => v.slug === "cosmos-lonely-bloom")!.deletedAt).toBeNull();
  });

  it("the reviewer is refused account role changes AND account reads at the API", async () => {
    const write = await post("/api/internal/admin/accounts/actions", { action: "role_save", account: 3, role: "reviewer" }, REVIEWER);
    expect(write.status).toBe(403);
    expect(stub.state.admin.accounts.find((a) => a.id === 3)!.role).toBe("visitor");
    const read = await get("/api/internal/admin/accounts", REVIEWER);
    expect(read.status).toBe(403);
    const detail = await get("/api/internal/admin/accounts/3", REVIEWER);
    expect(detail.status).toBe(403);
  });

  it("the reviewer is refused removal-apply and report-retire at the API", async () => {
    const removal = await post("/api/internal/admin/review/decide", { action: "apply_removal", kind: "review", id: 105 }, REVIEWER);
    expect(removal.status).toBe(403);
    expect(stub.state.admin.review.find((i) => i.id === 105)!.status).toBe("pending");
    const retire = await post("/api/internal/admin/review/decide", { action: "retire_listing", kind: "review", id: 104, listing_id: 2, reason: "Dead link" }, REVIEWER);
    expect(retire.status).toBe(403);
  });

  it("the full admin can do all of it", async () => {
    expect((await post("/api/internal/admin/review/decide", { action: "mark_duplicate", kind: "review", id: 103 }, ADMIN)).status).toBe(200);
    expect((await post("/api/internal/admin/varieties/actions", { action: "variety_remove", variety: "cosmos-lonely-bloom" }, ADMIN)).status).toBe(200);
    expect((await post("/api/internal/admin/accounts/actions", { action: "role_save", account: 3, role: "reviewer" }, ADMIN)).status).toBe(200);
    expect((await post("/api/internal/admin/review/decide", { action: "apply_removal", kind: "review", id: 105 }, ADMIN)).status).toBe(200);
  });

  it("signed-out and unauthorized reads are refused on every admin read", async () => {
    const paths = [
      "/api/internal/admin/home",
      "/api/internal/admin/review/queue?queue=listings",
      "/api/internal/admin/review/detail?kind=review&id=101",
      "/api/internal/admin/sellers",
      "/api/internal/admin/sellers/blue-ridge-seeds",
      "/api/internal/admin/varieties",
      "/api/internal/admin/varieties/cosmos-lonely-bloom",
      "/api/internal/admin/listings",
      "/api/internal/admin/listings/501",
      "/api/internal/admin/accounts",
      "/api/internal/admin/statistics/overview",
      "/api/internal/admin/statistics/popularity?signal=views",
    ];
    for (const path of paths) {
      expect((await get(path)).status, `${path} signed-out`).toBe(401);
      expect((await get(path, VISITOR)).status, `${path} visitor`).toBe(403);
    }
  });
});

describe("review flows", () => {
  it("approving the listing match publishes it onto the public variety", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "publish_listing", kind: "review", id: 101 }, ADMIN);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "published", variety: "Lonely Bloom" });
    const detail = stub.state.details["cosmos-lonely-bloom"];
    expect(detail.listings.map((l) => l.id)).toContain(900);
  });

  it("decideDuplicate keeps the held name as an alternate name on the existing variety", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "mark_duplicate", kind: "review", id: 103 }, ADMIN);
    expect(res.status).toBe(200);
    const variety = stub.state.admin.varieties.find((v) => v.slug === "sweet-pea-kings-ransom")!;
    expect(variety.aliases).toContainEqual({ alias: "King's Ransom Select", source: "duplicate_decision", decidedByName: "Dustin", createdAt: stub.state.admin.now });
    expect(stub.state.details["sweet-pea-kings-ransom"].aliases).toContain("King's Ransom Select");
    // And the held name still turns up in public search.
    const search = await get("/api/v1/search?q=ransom+select");
    expect(JSON.stringify(search.json)).toContain("King's Ransom Select");
  });

  it("the false-queue item is rejectable", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "dismiss_report", kind: "review", id: 104, reason: "The listing is live — nothing to do." }, ADMIN);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "report_dismissed" });
    expect(stub.state.admin.review.find((i) => i.id === 104)!.reason).toBe("The listing is live — nothing to do.");
  });

  it("duplicate holds are refused on the key API (approve AND reject), left pending", async () => {
    for (const verb of ["approve", "reject"]) {
      const res = await post(`/api/v1/admin/review/103/${verb}`, {}, undefined, true);
      expect(res.status, verb).toBe(422);
      expect(res.json).toMatchObject({ code: "duplicate_hold_ui_only" });
    }
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("pending");
    expect(stub.state.details["sweet-pea-kings-ransom"].aliases).not.toContain("King's Ransom Select");
  });

  it("a generic decide action cannot resolve a hold outside the duplicate path", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "publish_listing", kind: "review", id: 103 }, ADMIN);
    expect(res.status).toBe(422);
    expect(stub.state.admin.review.find((i) => i.id === 103)!.status).toBe("pending");
  });
});

describe("seller candidates + farm submissions + confirm (both roles)", () => {
  it("candidate approve creates the candidate seller; decline keeps the reason", async () => {
    const approved = await post("/api/internal/admin/review/decide", { action: "approve_candidate", kind: "review", id: 106 }, REVIEWER);
    expect(approved.status).toBe(200);
    expect(data(approved.json)).toMatchObject({ status: "seller_created" });
    const created = stub.state.admin.sellers.find((s) => s.slug === "foxglove-farm")!;
    expect(created.eligibility).toBe("candidate");
    expect(stub.state.admin.review.find((i) => i.id === 106)!.status).toBe("approved");
  });

  it("candidate decline resolves with the reason kept", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "decline_candidate", kind: "review", id: 106, reason: "Not a seed seller." }, REVIEWER);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "candidate_declined" });
    expect(stub.state.admin.review.find((i) => i.id === 106)!.reason).toBe("Not a seed seller.");
  });

  it("farm approve creates the seller; farm decline resolves", async () => {
    const approved = await post("/api/internal/admin/review/decide", { action: "approve_farm", kind: "farm", id: 201 }, ADMIN);
    expect(approved.status).toBe(200);
    expect(stub.state.admin.sellers.map((s) => s.slug)).toContain("quinn-probe-acres");
    expect(stub.state.admin.farmSubmissions.find((s) => s.id === 201)!.status).toBe("approved");
  });

  it("confirm verifies a report without resolving it", async () => {
    const res = await post("/api/internal/admin/review/decide", { action: "confirm_report", kind: "review", id: 104 }, REVIEWER);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "report_verified" });
    const item = stub.state.admin.review.find((i) => i.id === 104)!;
    expect(item.status).toBe("pending");
    expect(item.proposal.verifiedBy).toBe("Ruth Reviewer");
  });

  it("the decided segment lists resolutions newest-first; detail carries rank", async () => {
    await post("/api/internal/admin/review/decide", { action: "dismiss_report", kind: "review", id: 104 }, ADMIN);
    const decided = await get("/api/internal/admin/review/decided?queue=reports", ADMIN);
    expect(decided.status).toBe(200);
    const body = data(decided.json) as { rows: { outcome: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.rows[0]!.outcome).toBe("Declined");
    const detail = await get("/api/internal/admin/review/detail?kind=review&id=102", ADMIN);
    expect((data(detail.json) as { rank: { rank: number; total: number } }).rank).toEqual({ rank: 1, total: 2 });
  });
});

describe("remove flows", () => {
  it("variety-remove with live listings is BLOCKED naming the count, with no state change", async () => {
    const res = await post("/api/internal/admin/varieties/actions", { action: "variety_remove", variety: "sweet-pea-kings-ransom" }, ADMIN);
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ code: "variety_has_listings" });
    expect(String((res.json as { detail: string }).detail)).toContain("3 live listings");
    expect(stub.state.admin.varieties.find((v) => v.slug === "sweet-pea-kings-ransom")!.deletedAt).toBeNull();
  });

  it("variety-remove on the listing-free variety soft-removes (record stays, public 404s)", async () => {
    const res = await post("/api/internal/admin/varieties/actions", { action: "variety_remove", variety: "cosmos-lonely-bloom" }, ADMIN);
    expect(res.status).toBe(200);
    expect(data(res.json)).toMatchObject({ status: "variety_removed", already_removed: false });
    const variety = stub.state.admin.varieties.find((v) => v.slug === "cosmos-lonely-bloom")!;
    expect(variety.deletedAt).toBe(stub.state.admin.now);
    const pub = await get("/api/v1/varieties/cosmos-lonely-bloom");
    expect(pub.status).toBe(404);
    // Repeat: idempotent no-op success.
    const again = await post("/api/internal/admin/varieties/actions", { action: "variety_remove", variety: "cosmos-lonely-bloom" }, ADMIN);
    expect(again.status).toBe(200);
    expect(data(again.json)).toMatchObject({ already_removed: true });
  });

  it("listing-remove is idempotent (second call a no-op success writing nothing)", async () => {
    const first = await post("/api/internal/admin/listings/actions", { action: "retire", listing: 501, reason: "Dead link" }, ADMIN);
    expect(first.status).toBe(200);
    expect(data(first.json)).toMatchObject({ status: "retired", already_removed: false });
    const historyLength = stub.state.admin.listings.find((l) => l.id === 501)!.history.length;
    const second = await post("/api/internal/admin/listings/actions", { action: "retire", listing: 501, reason: "Dead link" }, ADMIN);
    expect(second.status).toBe(200);
    expect(data(second.json)).toMatchObject({ status: "retired", already_removed: true });
    expect(stub.state.admin.listings.find((l) => l.id === 501)!.history.length).toBe(historyLength);
  });
});

describe("statistics fixtures (hand-computed)", () => {
  it("views rank Candy Stripe 1, King's Ransom 2, Lonely Bloom 3 with movement up/down/same", async () => {
    const res = await get("/api/internal/admin/statistics/popularity?signal=views", ADMIN);
    const rows = data(res.json).rows as { rank: number; slug: string; value: number; movement: { text: string } }[];
    expect(rows.map((r) => [r.slug, r.value, r.movement.text])).toEqual([
      ["cosmos-candy-stripe", 120, "▲ 1"],
      ["sweet-pea-kings-ransom", 90, "▼ 1"],
      ["cosmos-lonely-bloom", 60, "—"],
    ]);
  });

  it("clicks order differently (Lonely Bloom first) and exclude the 50 bot clicks", async () => {
    const res = await get("/api/internal/admin/statistics/popularity?signal=clicks", ADMIN);
    const rows = data(res.json).rows as { slug: string; value: number }[];
    expect(rows.map((r) => [r.slug, r.value])).toEqual([
      ["cosmos-lonely-bloom", 40],
      ["cosmos-candy-stripe", 25],
      ["sweet-pea-kings-ransom", 10],
    ]);
  });

  it("waitlist is the current list at every range", async () => {
    for (const range of ["7d", "30d", "12w"]) {
      const res = await get(`/api/internal/admin/statistics/popularity?range=${range}&signal=waitlist`, ADMIN);
      const rows = data(res.json).rows as { slug: string; waiters: number }[];
      expect(rows.map((r) => [r.slug, r.waiters]), range).toEqual([
        ["cosmos-lonely-bloom", 7],
        ["cosmos-mystery-bloom", 5],
        ["sweet-pea-kings-ransom", 2],
      ]);
    }
  });

  it("searches carry counts, modal finds, and the fruitless table", async () => {
    const res = await get("/api/internal/admin/statistics/popularity?signal=searches", ADMIN);
    const body = data(res.json);
    expect(body.top).toEqual([
      { term: "cosmos", count: 30, finds: { slug: "cosmos-candy-stripe", name: "Candy Stripe" } },
      { term: "ransom", count: 12, finds: { slug: "sweet-pea-kings-ransom", name: "King's Ransom" } },
      { term: "lonely blum", count: 4, finds: null },
    ]);
    expect(body.noResults).toEqual([{ term: "xyz-no-match", count: 5 }]);
  });

  it("the Visitors card ships dark in v2's data shape (no number, pinned line)", async () => {
    const res = await get("/api/internal/admin/statistics/overview", ADMIN);
    const cards = data(res.json).cards as Record<string, unknown>[];
    const visitors = cards[0]!;
    expect(visitors).toMatchObject({ key: "visitors", label: "Visitors", total: null, delta: null, trend: null, error: false });
    expect(visitors.noData).toBe("Visitor counts come from Cloudflare Web Analytics. It isn’t connected to the directory yet, so there are no visitor numbers to show.");
    // No number anywhere except the range caption's dates (v2's dark-card rule).
    expect(JSON.stringify({ total: visitors.total, delta: visitors.delta, trend: visitors.trend, noData: visitors.noData })).not.toMatch(/\d/);
  });
});

describe("internal-notes guarantee + no-price rule (stub level)", () => {
  it("public seller payloads contain NO internal-note text", async () => {
    for (const slug of ["blue-ridge-seeds", "prairie-seed-house"]) {
      const res = await get(`/api/v1/sellers/${slug}`);
      expect(res.status).toBe(200);
      const text = JSON.stringify(res.json);
      expect(text).not.toContain("NOTE-BLUERIDGE-7A");
      expect(text).not.toContain("NOTE-PRAIRIE-7B");
      expect(text).not.toContain("internal");
    }
  });

  it("public variety payloads contain NO internal-note text", async () => {
    const res = await get("/api/v1/varieties/sweet-pea-kings-ransom");
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.json);
    expect(text).not.toContain("NOTE-BLUERIDGE-7A");
    expect(text).not.toContain("NOTE-PRAIRIE-7B");
  });

  it("source-data prices exist but surface in NO payload (public or admin)", async () => {
    expect(Object.keys(stub.state.admin.internalPrices).length).toBeGreaterThan(0);
    const paths = [
      "/api/v1/sellers/blue-ridge-seeds",
      "/api/v1/varieties/sweet-pea-kings-ransom",
      "/api/internal/admin/sellers/blue-ridge-seeds",
      "/api/internal/admin/listings/501",
      "/api/internal/admin/review/detail?kind=review&id=101",
    ];
    for (const path of paths) {
      const res = await get(path, path.startsWith("/api/internal") ? ADMIN : undefined);
      expect(res.status, path).toBe(200);
      const text = JSON.stringify(res.json);
      for (const marker of Object.values(stub.state.admin.internalPrices)) {
        expect(text, `${path} leaks ${marker}`).not.toContain(marker);
      }
      expect(text, `${path} price key`).not.toMatch(/"price|"lowPrice|"priceCents/);
    }
  });
});

describe("action log + modes (fixture vi)", () => {
  it("records received payloads verbatim", async () => {
    await post("/api/internal/admin/sellers/actions", { action: "add_note", seller: "geoseed", body: "Verbatim  body — keep  spacing." }, ADMIN);
    const last = stub.state.admin.received[stub.state.admin.received.length - 1]!;
    expect(last).toEqual({ endpoint: "admin:sellerActions", body: { action: "add_note", seller: "geoseed", body: "Verbatim  body — keep  spacing." } });
  });

  it("a rejecting mode refuses AFTER recording (rejection preserves the payload)", async () => {
    stub.state.admin.modes.decide = "reject";
    const res = await post("/api/internal/admin/review/decide", { action: "publish_listing", kind: "review", id: 101 }, ADMIN);
    expect(res.status).toBe(422);
    expect(stub.state.admin.review.find((i) => i.id === 101)!.status).toBe("pending");
    const last = stub.state.admin.received[stub.state.admin.received.length - 1]!;
    expect(last.body).toEqual({ action: "publish_listing", kind: "review", id: 101 });
  });
});

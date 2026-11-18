/** Internal routes: POST /api/revalidate (token), POST /api/track (view + legacy click beacon), GET /go/{id}. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({ services: null as unknown, env: null as unknown, revalidated: [] as string[] }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => ctx.services }));
vi.mock("@/lib/api/runtime-env", () => ({ getRuntimeEnv: async () => ctx.env }));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => ctx.revalidated.push(`path:${p}`),
  revalidateTag: (t: string) => ctx.revalidated.push(`tag:${t}`),
}));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";
import * as revalidate from "@/app/api/revalidate/route";
import * as track from "@/app/api/track/route";
import * as go from "@/app/go/[id]/route";

let t: TestD1;
const TOKEN = "test-token-not-a-secret";

beforeAll(async () => {
  t = await createTestD1();
  ctx.services = createServices(t.db);
  ctx.env = { siteUrl: "https://seeds.hues.flowers", corsOrigins: [], rateLimiter: null, snapshots: null, revalidateToken: TOKEN, clickSalt: "test-salt" };
});
afterAll(async () => {
  await t?.env.DB.prepare("DELETE FROM outbound_clicks").run(); // HR6
  await t?.env.DB.prepare("DELETE FROM click_events").run();
  await t?.env.DB.prepare("DELETE FROM variety_view_counts").run();
  await t?.dispose();
});

const post = (h: (r: Request) => Promise<Response>, path: string, body: unknown, headers: Record<string, string> = {}) =>
  h(
    new Request(`https://seeds.hues.flowers${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/revalidate", () => {
  it("401 without or with a wrong token", async () => {
    expect((await post(revalidate.POST, "/api/revalidate", { tags: ["list:home"] })).status).toBe(401);
    const wrong = await post(revalidate.POST, "/api/revalidate", { tags: ["list:home"] }, { Authorization: "Bearer nope" });
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("X-Robots-Tag")).toBe("noindex");
  });
  it("400 on malformed bodies", async () => {
    const auth = { Authorization: `Bearer ${TOKEN}` };
    expect((await post(revalidate.POST, "/api/revalidate", "{not json", auth)).status).toBe(400);
    expect((await post(revalidate.POST, "/api/revalidate", {}, auth)).status).toBe(400);
    expect((await post(revalidate.POST, "/api/revalidate", { tags: ["evil tag"] }, auth)).status).toBe(400);
  });
  it("revalidates tag-mapped paths with a valid token", async () => {
    ctx.revalidated.length = 0;
    const res = await post(
      revalidate.POST,
      "/api/revalidate",
      { tags: ["variety:stock-katz-mix"], paths: ["/about"] },
      { Authorization: `Bearer ${TOKEN}` },
    );
    expect(res.status).toBe(200);
    expect(ctx.revalidated).toEqual(expect.arrayContaining(["tag:variety:stock-katz-mix", "path:/variety/stock-katz-mix", "path:/about"]));
  });
});

describe("POST /api/track", () => {
  const count = async () =>
    (await t.env.DB.prepare("SELECT count(*) n FROM outbound_clicks").first<{ n: number }>())?.n ?? 0;

  it("records a click matching a real listing URL and always answers 204", async () => {
    const before = await count();
    const res = await post(track.POST, "/api/track", {
      seller: "songbird-seed-co",
      variety: "sweet-pea-kings-ransom",
      href: "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m",
    });
    expect(res.status).toBe(204);
    expect(await count()).toBe(before + 1);
    const row = await t.env.DB.prepare(
      "SELECT c.target_url, c.listing_id IS NOT NULL AS has_listing FROM outbound_clicks c ORDER BY id DESC LIMIT 1",
    ).first<{ target_url: string; has_listing: number }>();
    expect(row).toEqual({ target_url: "https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m", has_listing: 1 });
  });
  it("ignores URLs that are not on file, garbage, and unknown sellers (still 204)", async () => {
    const before = await count();
    for (const body of [
      { seller: "songbird-seed-co", variety: "sweet-pea-kings-ransom", href: "https://evil.example/" },
      { seller: "no-such-seller", href: "https://example.org" },
      "not json",
      { seller: "UPPER", href: "x" },
    ]) {
      expect((await post(track.POST, "/api/track", body)).status).toBe(204);
    }
    expect(await count()).toBe(before);
  });
});

describe("POST /api/track — view beacon (R14)", () => {
  const views = async () =>
    (await t.env.DB.prepare("SELECT coalesce(sum(views), 0) n FROM variety_view_counts").first<{ n: number }>())?.n ?? 0;
  it("counts {type: view, varietySlug} and ignores unknown varieties (always 204)", async () => {
    const before = await views();
    expect((await post(track.POST, "/api/track", { type: "view", varietySlug: "stock-katz-mix" })).status).toBe(204);
    expect((await post(track.POST, "/api/track", { type: "view", varietySlug: "no-such-variety" })).status).toBe(204);
    expect((await post(track.POST, "/api/track", { type: "view", varietySlug: "BAD SLUG" })).status).toBe(204);
    expect(await views()).toBe(before + 1);
  });
});

describe("GET /go/{listing_id} (R7)", () => {
  const goReq = (id: string, headers: Record<string, string> = {}) =>
    go.GET(new Request(`https://seeds.hues.flowers/go/${id}`, { headers }), { params: Promise.resolve({ id }) });

  it("302 to the product URL with UTM tags, no-store, and a click_events row", async () => {
    const res = await goReq("1", {
      "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
      referer: "https://seeds.hues.flowers/variety/sweet-pea-kings-ransom",
      "cf-connecting-ip": "198.51.100.4",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://www.songbirdseeds.com/seedshop/p/kingsransom-54d2m?utm_source=seedfinder&utm_medium=referral");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const row = await t.env.DB.prepare("SELECT page_type, client, is_bot FROM click_events ORDER BY id DESC LIMIT 1").first();
    expect(row).toEqual({ page_type: "variety", client: "chrome", is_bot: 0 });
  });

  it("falls back to the seller homepage when a listing has no product URL", async () => {
    const res = await goReq("2", { "user-agent": "Mozilla/5.0 Firefox/133.0" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://www.songbirdseeds.com/?utm_source=seedfinder&utm_medium=referral");
  });

  it("404 for unknown or malformed ids", async () => {
    expect((await goReq("999999")).status).toBe(404);
    expect((await goReq("abc")).status).toBe(404);
  });
});

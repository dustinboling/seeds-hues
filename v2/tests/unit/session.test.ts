/**
 * Direct tests for lib/session.ts (refactor R2 §5): getCurrentUser / getCurrentUserRow
 * with the suite's existing mocking patterns (mocked next/headers cookies plus a fake
 * accounts service). getCurrentUserRow is React-cache()d, so each case re-imports the
 * module after vi.resetModules() for a fresh memo. Pins current behavior.
 */
import { describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/accounts";
import type { UserRow } from "@/lib/repositories/accounts";

const cookieStore = vi.hoisted(() => ({ token: null as string | null }));
const store = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    // The factory is hoisted and cannot reference the SESSION_COOKIE import; the name
    // is pinned against the import in the first test so a rename fails loudly.
    get: (name: string) => (name === "sf_session" && cookieStore.token ? { value: cookieStore.token } : undefined),
  }),
}));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));

import { fakeServices } from "../helpers/services-context";

async function freshSession() {
  vi.resetModules();
  return import("@/lib/session");
}

const ROW = {
  name: "Test User",
  email: "test@example.com",
  phone: "5415550123",
  zip: "97448",
  usdaZone: "8b",
  emailVerified: true,
  notifyOptOut: false,
  farmOwnerDeclared: true,
  isFarmOwner: false,
  alertPhone: "5415550199",
  alertPhoneVerified: true,
  smsOptIn: true,
} as unknown as UserRow;

describe("getCurrentUser", () => {
  it("no session cookie → null, without touching accounts", async () => {
    expect(SESSION_COOKIE).toBe("sf_session");
    cookieStore.token = null;
    const userForSession = vi.fn(async () => null);
    store.services = fakeServices({ accounts: { userForSession } });
    const { getCurrentUser } = await freshSession();
    expect(await getCurrentUser()).toBeNull();
    expect(userForSession).not.toHaveBeenCalled();
  });

  it("an unknown token → null", async () => {
    cookieStore.token = "bogus-token";
    store.services = fakeServices({ accounts: { userForSession: async () => null } });
    const { getCurrentUser } = await freshSession();
    expect(await getCurrentUser()).toBeNull();
  });

  it("a valid token → the public user (the ZIP is never echoed back)", async () => {
    cookieStore.token = "good-token";
    store.services = fakeServices({ accounts: { userForSession: async () => ROW } });
    const { getCurrentUser, getCurrentUserRow } = await freshSession();
    expect(await getCurrentUserRow()).toBe(ROW);
    const user = await getCurrentUser();
    expect(user).toEqual({
      name: "Test User",
      email: "test@example.com",
      phone: "5415550123",
      phone_display: "(541) 555-0123",
      usda_zone: "8b",
      email_verified: true,
      notify_opt_out: false,
      farm_owner_declared: true,
      is_farm_owner: false,
      alert_phone: "5415550199",
      alert_phone_display: "(541) 555-0199",
      alert_phone_verified: true,
      sms_opt_in: true,
    });
    expect("zip" in (user as unknown as Record<string, unknown>)).toBe(false);
  });
});

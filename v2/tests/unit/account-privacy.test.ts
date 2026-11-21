/**
 * Phase 3 guardrails (source-level; the data-level check — no account rows in snapshot / sync
 * output — lives in tests/integration/accounts.test.ts):
 *  - the private account tables are never in the snapshot allowlist, and the snapshot / sync /
 *    public read paths never import them;
 *  - the verified farm-owner flag is written only by the admin path;
 *  - signing in never involves a verification code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { SNAPSHOT_ALLOWLIST } from "@/lib/repositories/snapshot-allowlist";
import * as schema from "@/lib/db/schema";

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const ACCOUNT_TABLE_EXPORTS = ["users", "sessions", "authAttempts", "emailVerificationCodes", "phoneVerificationCodes", "farmOwnerAudit", "waitlistEntries", "notificationOutbox", "farmSubmissions", "adminSessions", "adminSigninCodes", "roleAudit"] as const;

describe("account tables are private", () => {
  it("PRIVATE_ACCOUNT_TABLES names every account table in the schema", () => {
    const names = ACCOUNT_TABLE_EXPORTS.map((k) => getTableName(schema[k]));
    expect([...names].sort()).toEqual([...schema.PRIVATE_ACCOUNT_TABLES].sort());
  });

  it("none of them is in the snapshot allowlist (users / sessions / waitlist_entries / notification_outbox / farm_submissions …)", () => {
    const allow = SNAPSHOT_ALLOWLIST.map((t) => t.name);
    for (const t of schema.PRIVATE_ACCOUNT_TABLES) expect(allow).not.toContain(t);
    for (const t of SNAPSHOT_ALLOWLIST) expect(schema.PRIVATE_ACCOUNT_TABLES as readonly string[]).not.toContain(getTableName(t.table));
  });

  it("the snapshot, sync and public catalog read paths never import an account table", () => {
    for (const f of ["lib/repositories/snapshot-allowlist.ts", "lib/repositories/snapshot.ts", "lib/repositories/sync.ts", "lib/services/sync.ts", "lib/repositories/catalog-read.ts", "lib/services/catalog.ts", "lib/api/openapi.ts", "scripts/publish-catalog.ts"]) {
      const src = read(f);
      const imports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/db\/schema"/g)].flatMap((m) => m[1]!.split(",").map((x) => x.trim()));
      for (const t of ACCOUNT_TABLE_EXPORTS) expect(imports, `${f} imports ${t}`).not.toContain(t);
      expect(src, f).not.toMatch(/waitlist_entries|notification_outbox|farm_submissions|email_verification_codes/);
    }
  });
});

describe("the farm-owner flag is admin-set only", () => {
  it("is_farm_owner is written only by the repository's audited setFarmOwner(), called only from the admin farm service", () => {
    const writers = ["lib/repositories/accounts.ts", "lib/services/farms.ts"];
    for (const f of ["lib/services/accounts.ts", "lib/api/account-routes.ts", "app/api/v1/farm-submissions/route.ts", "components/account/SignupFields.tsx", "components/account/AccountPanel.tsx", "components/account/CreateAccountForm.tsx"]) {
      expect(read(f), f).not.toMatch(/isFarmOwner\s*:|setFarmOwner/);
    }
    for (const f of writers) expect(read(f)).toMatch(/isFarmOwner/);
    expect(read("lib/repositories/accounts.ts")).toMatch(/farmOwnerAudit/);
  });
});

describe("sign-in is the email + phone pair — no codes", () => {
  it("the signIn() implementation never touches the verification service", () => {
    const src = read("lib/services/accounts.ts");
    const body = src.slice(src.indexOf("async signIn("), src.indexOf("async signOut("));
    expect(body.length).toBeGreaterThan(100);
    expect(body).not.toMatch(/verification|code/i);
  });
});

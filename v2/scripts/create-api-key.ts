/**
 * Mint an API key (design D5). Stores ONLY the SHA-256 hash in api_keys and prints the token once.
 *
 *   tsx scripts/create-api-key.ts --scope ingest --label "crawler (mac mini)"
 *   tsx scripts/create-api-key.ts --scope admin,ingest --label owner [--persist-to <dir>]
 *   tsx scripts/create-api-key.ts ... --json        # machine-readable {id, token, scopes}
 *   tsx scripts/create-api-key.ts --revoke <id>     # revoke a key (stamps revoked_at)
 *
 * Local D1 by default (same store as `wrangler dev` / the OpenNext preview).
 */
import { createDb } from "@/lib/db/client";
import { revokeApiKey } from "@/lib/repositories/api-keys";
import { API_SCOPES, createAuthService, type ApiScope } from "@/lib/services/auth";
import { openPlatform, parseArgs } from "./lib/platform";

async function main() {
  const args = parseArgs();
  const revoke = args.values.get("revoke");
  if (revoke !== undefined) {
    if (!/^\d+$/.test(revoke)) {
      console.error("--revoke takes a numeric key id");
      process.exit(2);
    }
    const proxy = await openPlatform(args);
    try {
      const ok = await revokeApiKey(createDb(proxy.env.DB), Number(revoke), new Date().toISOString());
      console.log(ok ? `API key ${revoke} revoked` : `API key ${revoke} not found or already revoked`);
    } finally {
      await proxy.dispose();
    }
    return;
  }
  const scopes = (args.values.get("scope") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const label = args.values.get("label")?.trim();
  if (!label || scopes.length === 0 || !scopes.every((s) => (API_SCOPES as readonly string[]).includes(s))) {
    console.error(`usage: tsx scripts/create-api-key.ts --scope <${API_SCOPES.join("|")}>[,…] --label <text> [--json]`);
    process.exit(2);
  }
  const proxy = await openPlatform(args);
  try {
    const { id, token } = await createAuthService(createDb(proxy.env.DB)).mint(label, scopes as ApiScope[]);
    if (args.flags.has("json")) {
      console.log(JSON.stringify({ id, token, scopes, label }));
    } else {
      console.log(`API key ${id} (${scopes.join(", ")}) — "${label}"`);
      console.log(`\n  ${token}\n`);
      console.log("This token is shown once. Only its SHA-256 hash is stored. Send it as: Authorization: Bearer <token>");
    }
  } finally {
    await proxy.dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

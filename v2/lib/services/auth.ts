/**
 * API key auth for ingest/admin (design D5). Tokens are random, shown once; only their SHA-256
 * hex digest is stored. WebCrypto only (no Node built-ins), so this runs in the Worker.
 */
import type { Db } from "@/lib/db/client";
import { apiKeyByHash, insertApiKey, touchApiKey } from "@/lib/repositories/api-keys";
import { sha256Hex } from "@/lib/api/http";

export const API_SCOPES = ["ingest", "admin"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export interface ApiKeyPrincipal {
  id: number;
  label: string;
  scopes: ApiScope[];
}

/** "sf_<scope>_<43 base64url chars>" — 256 bits of randomness. */
export function generateToken(scope: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `sf_${scope}_${b64}`;
}

export function hashToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export function createAuthService(db: Db) {
  return {
    /** Principal for a bearer token, or null when unknown/revoked. Stamps last_used_at. */
    async verify(token: string): Promise<ApiKeyPrincipal | null> {
      if (!/^[\w-]{20,200}$/.test(token)) return null;
      const row = await apiKeyByHash(db, await hashToken(token));
      if (!row) return null;
      let scopes: ApiScope[] = [];
      try {
        const parsed: unknown = JSON.parse(row.scopes);
        if (Array.isArray(parsed)) scopes = parsed.filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(String(s)));
      } catch {
        scopes = [];
      }
      await touchApiKey(db, row.id, new Date().toISOString());
      return { id: row.id, label: row.label, scopes };
    },

    /** Mint a key: stores the hash, returns the token (the only time it exists in clear). */
    async mint(label: string, scopes: ApiScope[]): Promise<{ id: number; token: string }> {
      const token = generateToken(scopes.join("-"));
      const id = await insertApiKey(db, { keyHash: await hashToken(token), label, scopes, createdAt: new Date().toISOString() });
      return { id, token };
    },
  };
}

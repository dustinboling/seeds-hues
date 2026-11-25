/**
 * Account primitives the app's surfaces share, ported from
 * v2/lib/accounts.ts (the constants only — sessions, codes, and tokens
 * stay the backend's, unchanged; the app never mints, hashes, or
 * verifies them).
 */

/** One-time 6-digit codes work for 30 minutes (USER-ACCOUNTS-DESIGN §2a). */
export const CODE_TTL_MINUTES = 30;

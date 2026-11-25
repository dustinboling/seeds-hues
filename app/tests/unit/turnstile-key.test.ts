/**
 * Slice 6: the Turnstile site-key read — per-render pageContext wins (the
 * Worker-safe path), the process env is the Node-harness fallback, and a
 * missing key reads null (the forms render v2's "isn't set up" note).
 */
import { describe, expect, it } from "vitest";
import { turnstileSiteKey } from "../../src/data/load";

describe("turnstileSiteKey", () => {
  it("prefers the per-render pageContext key over the environment", () => {
    expect(turnstileSiteKey({ turnstileSiteKey: "per-render-key" }, { SEEDS_TURNSTILE_SITE_KEY: "env-key" } as NodeJS.ProcessEnv)).toBe(
      "per-render-key",
    );
  });

  it("falls back to the environment outside a render", () => {
    expect(turnstileSiteKey(undefined, { SEEDS_TURNSTILE_SITE_KEY: "env-key" } as NodeJS.ProcessEnv)).toBe("env-key");
    expect(turnstileSiteKey({}, { SEEDS_TURNSTILE_SITE_KEY: "env-key" } as NodeJS.ProcessEnv)).toBe("env-key");
  });

  it("reads null when no key is configured anywhere", () => {
    expect(turnstileSiteKey(undefined, {} as NodeJS.ProcessEnv)).toBeNull();
    expect(turnstileSiteKey({ turnstileSiteKey: null }, { SEEDS_TURNSTILE_SITE_KEY: "env-key" } as NodeJS.ProcessEnv)).toBeNull();
  });
});

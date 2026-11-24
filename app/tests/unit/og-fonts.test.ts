/**
 * OG font provenance: the share surface keeps v2's exact bundled bytes —
 * the Fraunces static instance v2 vendors, and the same Geist Regular file
 * next/og ships (copied once from v2's installed next package, sha-pinned
 * here so a substitution breaks loudly instead of landing silently).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FONTS = fileURLToPath(new URL("../../src/og/fonts", import.meta.url));
const V2_FONTS = fileURLToPath(new URL("../../../v2/app/fonts", import.meta.url));

const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

describe("OG fonts", () => {
  it("bundles v2's exact Fraunces static instance", () => {
    const ours = readFileSync(`${FONTS}/fraunces-og.ttf`);
    const v2 = readFileSync(`${V2_FONTS}/fraunces-og.ttf`);
    expect(ours.equals(v2)).toBe(true);
    expect(ours.length).toBeGreaterThan(10_000);
  });

  it("pins the Geist Regular bytes to their recorded digest", () => {
    const provenance = JSON.parse(readFileSync(`${FONTS}/PROVENANCE.json`, "utf8")) as {
      geist: { sha256: string; source: string };
    };
    expect(provenance.geist.source).toContain("Geist-Regular.ttf");
    const geist = readFileSync(`${FONTS}/geist-regular.ttf`);
    expect(sha256(geist)).toBe(provenance.geist.sha256);
    expect(geist.length).toBeGreaterThan(10_000);
  });
});

/**
 * Slice 8 structured-data inventory suite (unit — discharges the recurring
 * N3): the standalone `structured-data-inventory.md` at the repo root
 * names every template's as-built JSON-LD types, states the diff against
 * Bea §1.1's measured inventory, and carries no prohibited type or key.
 * The build suite proves the as-built column against emitted HTML,
 * template by template.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROHIBITED_JSONLD } from "../../src/lib/jsonld-guard";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** Every template Bea §1.1 inventories, by the doc's template key. */
const TEMPLATES = [
  "home",
  "variety-browse",
  "variety-detail",
  "seller-index",
  "seller-shop",
  "crop-index",
  "crop-hub",
  "series-hub",
  "state-hub",
  "static-informational",
] as const;

function inventory(): string {
  return readFileSync(`${REPO_ROOT}/structured-data-inventory.md`, "utf8");
}

describe("structured-data-inventory.md", () => {
  it("exists at the repo root and names every §1.1 template", () => {
    const doc = inventory();
    for (const template of TEMPLATES) {
      expect(doc, `template row: ${template}`).toContain(`| ${template} |`);
    }
  });

  it("states the diff verdict against Bea §1.1 plus the ruled §11 key additions", () => {
    const doc = inventory();
    expect(doc).toContain("Diff result: EXACT MATCH");
    expect(doc).toContain("PRERENDER-CONTENT-AUDIT.md §1.1");
    expect(doc).toContain("sameAs");
    expect(doc).toContain("logo");
  });

  it("records zero unruled diffs (every diff row is fixed or ruled)", () => {
    const doc = inventory();
    expect(doc).toContain("Unruled diffs: 0");
  });

  it("lists no prohibited type or key in any as-built cell", () => {
    const doc = inventory();
    const rows = doc.split("\n").filter((line) => line.startsWith("| ") && TEMPLATES.some((t) => line.includes(`| ${t} |`)));
    expect(rows.length).toBe(TEMPLATES.length);
    for (const row of rows) {
      for (const prohibited of PROHIBITED_JSONLD) {
        expect(row, `row must not contain ${prohibited}: ${row}`).not.toContain(prohibited);
      }
    }
  });
});

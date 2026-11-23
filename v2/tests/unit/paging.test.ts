/**
 * Direct tests for lib/paging.ts (refactor R2 §5): ?page= parsing, page windows and range
 * guards — plus the list-page filter params, which live in lib/browse.ts since Tranche 3.1a
 * (Hue went multi-select there; the single-select surfaces keep their rule). Pins current
 * behavior exactly — including assertPageInRange's throw semantics. Changing any of this is
 * a held workstream; these tests only prove what is.
 */
import { describe, expect, it } from "vitest";
import { assertPageInRange, pagePath, pageTitleSuffix, pageWindow, parsePage, totalPages } from "@/lib/paging";
import {
  parseHueParam,
  parseHueParamSingle,
  parseLifeCycleParam,
  parseMethodParam,
  parseSeasonParam,
} from "@/lib/browse";

/** What next/navigation's notFound() throws (its message and digest). */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

describe("parsePage", () => {
  it("missing → 1; a positive integer passes through", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("1")).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2"])).toBe(2);
  });

  it("zero, negatives, leading zeros, fractions and junk are real 404s", () => {
    for (const raw of ["0", "00", "01", "-1", "1.5", "abc", "", " 2", "9999999"]) {
      expect(() => parsePage(raw), JSON.stringify(raw)).toThrow(NOT_FOUND_DIGEST);
    }
  });
});

describe("pageWindow / totalPages", () => {
  it("windows are PAGE_SIZE (24) slices", () => {
    expect(pageWindow(1)).toEqual({ offset: 0, limit: 24 });
    expect(pageWindow(3)).toEqual({ offset: 48, limit: 24 });
    expect(pageWindow(2, 10)).toEqual({ offset: 10, limit: 10 });
  });

  it("there is always at least one page, even with zero rows", () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(24)).toBe(1);
    expect(totalPages(25)).toBe(2);
    expect(totalPages(48)).toBe(2);
    expect(totalPages(49)).toBe(3);
    expect(totalPages(20, 10)).toBe(2);
  });
});

describe("assertPageInRange", () => {
  it("passes on the last page, 404s past the end", () => {
    expect(() => assertPageInRange(1, 0)).not.toThrow();
    expect(() => assertPageInRange(1, 24)).not.toThrow();
    expect(() => assertPageInRange(2, 25)).not.toThrow();
    expect(() => assertPageInRange(2, 24)).toThrow(NOT_FOUND_DIGEST);
    expect(() => assertPageInRange(3, 25)).toThrow(NOT_FOUND_DIGEST);
  });
});

describe("pagePath / pageTitleSuffix", () => {
  it("page 1 is the bare path with no suffix", () => {
    expect(pagePath("/seller", 1)).toBe("/seller");
    expect(pageTitleSuffix(1)).toBe("");
  });

  it("later pages carry ?page= and a title suffix", () => {
    expect(pagePath("/seller", 3)).toBe("/seller?page=3");
    expect(pageTitleSuffix(2)).toBe(" — page 2");
  });
});

describe("filter params (unknown values are ignored, never 404)", () => {
  it("?season= is cool | warm", () => {
    expect(parseSeasonParam(undefined)).toBeNull();
    expect(parseSeasonParam("cool")).toBe("cool");
    expect(parseSeasonParam("warm")).toBe("warm");
    expect(parseSeasonParam("bogus")).toBeNull();
    expect(parseSeasonParam(["warm"])).toBe("warm");
  });

  it("?method= is direct | trays", () => {
    expect(parseMethodParam(undefined)).toBeNull();
    expect(parseMethodParam("direct")).toBe("direct");
    expect(parseMethodParam("trays")).toBe("trays");
    expect(parseMethodParam("bogus")).toBeNull();
  });

  it("?color_family= (multi) is a comma list and/or repeats, canonical order, garbage ignored", () => {
    expect(parseHueParam(undefined)).toEqual([]);
    expect(parseHueParam("pink")).toEqual(["pink"]);
    expect(parseHueParam("bogus")).toEqual([]);
    expect(parseHueParam("peach,pink")).toEqual(["pink", "peach"]);
    expect(parseHueParam(["pink", "pink,peach", "bogus"])).toEqual(["pink", "peach"]);
  });

  it("?color_family= (single) keeps today's exact rule: first raw value must be one family", () => {
    expect(parseHueParamSingle(undefined)).toBeNull();
    expect(parseHueParamSingle("pink")).toBe("pink");
    expect(parseHueParamSingle("bogus")).toBeNull();
    expect(parseHueParamSingle("pink,peach")).toBeNull();
    expect(parseHueParamSingle(["peach", "pink"])).toBe("peach");
  });

  it("?life_cycle= is annual | biennial | perennial", () => {
    expect(parseLifeCycleParam(undefined)).toBeNull();
    expect(parseLifeCycleParam("perennial")).toBe("perennial");
    expect(parseLifeCycleParam("bogus")).toBeNull();
  });
});

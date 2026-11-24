/**
 * Font-mechanics guard: the face table (fonts.ts), the stylesheet (fonts.css),
 * and the committed binaries (public/fonts/) must agree exactly, and nothing
 * may point at an external font host.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_FACES, FONT_STACKS, preloadFaces } from "../../src/design-system/fonts.js";

const PUBLIC_FONTS = fileURLToPath(new URL("../../public/fonts", import.meta.url));
const FONTS_CSS = fileURLToPath(new URL("../../src/design-system/fonts.css", import.meta.url));

// Recorded by `npm run sync:fonts`. A hash change means the binary moved —
// re-verify provenance and update deliberately, never blindly.
const EXPECTED_SHA256: Record<string, string> = {
  "fraunces-var.woff2": "7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783",
  "newsreader-var.woff2": "6e4f2958c3a7c4a80acde4e5a679abe7e01bc1e30b92be3c7a8b696ef401d101",
  "newsreader-var-italic.woff2": "5dfcd10d24af8c82927ba57f7983dd997f7b200594c09c35a1b1ed9fc4597506",
  "source-sans-3-latin-400-normal.woff2": "0f73f35e08cde0a2f10c109c6e01d71459d97e4099ecd9a50f1b6c0209e4de2b",
  "source-sans-3-latin-600-normal.woff2": "14527d193b0e30bc32ef931549a246cdfd286573bb12869b7e052b8101a39d38",
  "source-sans-3-latin-700-normal.woff2": "ae35266f2ab0d5314ff9a04127931eb26c793e4f1269bb240046d4d2db4b7bb1",
};

function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

describe("font binaries", () => {
  it("commits exactly the six wired faces, byte-verified", () => {
    const files = readdirSync(PUBLIC_FONTS).filter((file) => file.endsWith(".woff2")).sort();
    expect(files).toEqual(Object.keys(EXPECTED_SHA256).sort());
    for (const file of files) {
      const path = `${PUBLIC_FONTS}/${file}`;
      expect(readFileSync(path).length).toBeGreaterThan(0);
      expect(sha256Of(path), `${file} changed — re-verify provenance`).toBe(EXPECTED_SHA256[file]);
    }
  });

  it("keeps the editorial faces byte-identical to v2", () => {
    for (const file of ["fraunces-var.woff2", "newsreader-var.woff2", "newsreader-var-italic.woff2"]) {
      const ours = sha256Of(`${PUBLIC_FONTS}/${file}`);
      const live = sha256Of(
        fileURLToPath(new URL(`../../../v2/app/fonts/${file}`, import.meta.url)),
      );
      expect(ours, `${file} differs from v2`).toBe(live);
    }
  });
});

describe("fonts.css", () => {
  const css = readFileSync(FONTS_CSS, "utf8");

  it("declares every wired face exactly once, with matching descriptors", () => {
    for (const face of FONT_FACES) {
      const block = new RegExp(
        `@font-face\\s*{[^}]*font-family:\\s*"${face.family}"[^}]*src:\\s*url\\("${face.file}"\\)[^}]*font-weight:\\s*${face.weight.replace(" ", "\\s+")}[^}]*font-style:\\s*${face.style}[^}]*}`,
        "g",
      );
      expect(css.match(block)?.length ?? 0, `${face.file} @font-face`).toBe(1);
    }
    expect(css.match(/@font-face/g)?.length).toBe(FONT_FACES.length);
  });

  it("uses font-display: swap on every face and no external URLs", () => {
    expect(css.match(/font-display:\s*swap/g)?.length).toBe(FONT_FACES.length);
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/url\(\s*["']?\/\//);
  });
});

describe("font loading mechanics", () => {
  it("preloads exactly the LCP face (Fraunces upright)", () => {
    const preloaded = preloadFaces();
    expect(preloaded.map((face) => face.file)).toEqual(["/fonts/fraunces-var.woff2"]);
  });

  it("stacks put each family first with v2's fallbacks", () => {
    expect(FONT_STACKS.display.startsWith('"Fraunces"')).toBe(true);
    expect(FONT_STACKS.serif.startsWith('"Newsreader"')).toBe(true);
    expect(FONT_STACKS.sans.startsWith('"Source Sans 3"')).toBe(true);
    expect(FONT_STACKS.sans).toContain("system-ui");
  });

  it("records a license for every face (OFL-1.1 text committed)", () => {
    const ofl = readFileSync(
      fileURLToPath(new URL("../../src/design-system/OFL-1.1.txt", import.meta.url)),
      "utf8",
    );
    expect(ofl).toContain("SIL Open Font License, Version 1.1");
    const record = readFileSync(
      fileURLToPath(new URL("../../src/design-system/font-licenses.md", import.meta.url)),
      "utf8",
    );
    for (const face of FONT_FACES) {
      expect(record.includes(face.file.replace("/fonts/", "")), `${face.file} licensed`).toBe(true);
    }
    for (const family of ["Fraunces", "Newsreader", "Source Sans 3"]) {
      expect(record.includes(family)).toBe(true);
    }
  });
});

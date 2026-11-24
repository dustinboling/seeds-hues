/**
 * Slice-1 mirror of the @hues/fonts loading mechanics (see SWAP.md): self-hosted
 * woff2 under /fonts/, one preloaded LCP face, `font-display: swap` everywhere,
 * licenses recorded in font-licenses.md + OFL-1.1.txt. No external font URLs.
 *
 * Faces (Dustin Q2): Source Sans 3 for the UI/tool layer; Fraunces (display) +
 * Newsreader (prose) stay as the editorial faces, byte-identical to v2.
 */
export interface FontFaceEntry {
  family: "Fraunces" | "Newsreader" | "Source Sans 3";
  /** Site-absolute URL of the self-hosted woff2. */
  file: string;
  /** Declared weight range (mirrors v2's next/font wiring where it exists). */
  weight: string;
  style: "normal" | "italic";
  /** Preloaded in <head>. Exactly one face: headings are the LCP text (v2 rule). */
  preload: boolean;
  /** Where the bytes came from (reproducible via `npm run sync:fonts`). */
  source: string;
}

export const FONT_FACES: FontFaceEntry[] = [
  {
    family: "Fraunces",
    file: "/fonts/fraunces-var.woff2",
    weight: "400 700",
    style: "normal",
    preload: true,
    source: "v2/app/fonts/fraunces-var.woff2 (byte-identical)",
  },
  {
    family: "Newsreader",
    file: "/fonts/newsreader-var.woff2",
    weight: "400 600",
    style: "normal",
    preload: false,
    source: "v2/app/fonts/newsreader-var.woff2 (byte-identical)",
  },
  {
    family: "Newsreader",
    file: "/fonts/newsreader-var-italic.woff2",
    weight: "400 600",
    style: "italic",
    preload: false,
    source: "v2/app/fonts/newsreader-var-italic.woff2 (byte-identical)",
  },
  {
    family: "Source Sans 3",
    file: "/fonts/source-sans-3-latin-400-normal.woff2",
    weight: "400",
    style: "normal",
    preload: false,
    source: "@fontsource/source-sans-3@5.3.1, latin subset",
  },
  {
    family: "Source Sans 3",
    file: "/fonts/source-sans-3-latin-600-normal.woff2",
    weight: "600",
    style: "normal",
    preload: false,
    source: "@fontsource/source-sans-3@5.3.1, latin subset",
  },
  {
    family: "Source Sans 3",
    file: "/fonts/source-sans-3-latin-700-normal.woff2",
    weight: "700",
    style: "normal",
    preload: false,
    source: "@fontsource/source-sans-3@5.3.1, latin subset",
  },
];

/**
 * Family stacks. Editorial fallbacks mirror v2's (fonts.ts + globals.css);
 * the sans stack is v2's tool-layer system stack with Source Sans 3 first.
 */
export const FONT_STACKS = {
  display:
    '"Fraunces", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, ui-serif, serif',
  serif:
    '"Newsreader", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, ui-serif, serif',
  sans: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

/** Faces the shell preloads (preload discipline: the LCP face only). */
export function preloadFaces(): FontFaceEntry[] {
  return FONT_FACES.filter((face) => face.preload);
}

import localFont from "next/font/local";

/*
 * Self-hosted variable fonts (theme delta, THEME-ART-DIRECTION.md §2). Latin subset woff2 files
 * live in app/fonts/; next/font emits them under /_next/static/media/ (same origin, immutable).
 * No external font requests. Fraunces is the only preloaded face (headings are the LCP text);
 * Newsreader loads on first use via its @font-face rule.
 */
export const fraunces = localFont({
  src: "./fonts/fraunces-var.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  preload: true,
  variable: "--font-fraunces",
  adjustFontFallback: "Times New Roman",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
});

export const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-var.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/newsreader-var-italic.woff2", weight: "400 600", style: "italic" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-newsreader",
  adjustFontFallback: "Times New Roman",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
});

// Bundles src/sw/sw.ts with esbuild, then injects the precache manifest with
// Workbox's injectManifest. Runs as `npm run build:sw`, after `vike build`
// (which emits the static root at dist/client).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { injectManifest } from "workbox-build";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// SW_CLIENT_DIR retargets the SW build (the worker build passes its own
// client output); unset, the main build's dist/client stands as before.
const clientDir = process.env.SW_CLIENT_DIR ? join(root, process.env.SW_CLIENT_DIR) : join(root, "dist/client");
if (!existsSync(clientDir)) {
  throw new Error(`${process.env.SW_CLIENT_DIR ?? "dist/client"} is missing — run the app build first (via \`npm run build\` or \`npm run build:worker\`).`);
}
const swDest = join(clientDir, "sw.js");
buildSync({
  entryPoints: [join(root, "src/sw/sw.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: swDest,
  logLevel: "warning",
});
// Skeleton precache: the shell HTML, the manifest, the icon set. Hashed JS/CSS
// and fonts load on use; offline strategies are later slices.
const { count, size } = await injectManifest({
  swSrc: swDest,
  swDest,
  globDirectory: clientDir,
  globPatterns: ["**/*.html", "manifest.webmanifest", "icons/*"],
});
console.log(`sw.js: precaching ${count} files (${size} bytes)`);

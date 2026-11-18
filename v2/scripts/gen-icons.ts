/**
 * Generates the self-hosted PWA icons from the poppy pod mark
 * (public/brand/poppy-pod-mark.png) on the catalogue paper ground.
 *
 * Since 2026-11-16 the icons are composited from a raster mark, which the
 * original pure-Node vector renderer in this file could not draw — the actual
 * generator now lives in scripts/gen-icons.py (Pillow) and this entry point just
 * runs it, so `npm run icons` keeps working. Outputs: public/icons/hues-icon-192.png,
 * hues-icon-512.png, hues-icon-maskable-512.png, hues-apple-touch-icon.png,
 * hues-icon.svg, and public/favicon.ico.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

execFileSync("python3", [fileURLToPath(new URL("./gen-icons.py", import.meta.url))], { stdio: "inherit" });

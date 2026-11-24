/**
 * Gate-covered build proof: runs the real `npm run build` (vike build +
 * Workbox injectManifest + the post-build PWA proof) and asserts the key
 * artifacts exist. The post-build script already proves the details — a red
 * proof fails the build, which fails this test.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));

describe("production build", () => {
  it(
    "builds, emits the SW, and passes the post-build PWA proof",
    { timeout: 300_000 },
    () => {
      try {
        execFileSync("npm", ["run", "build"], {
          cwd: APP_ROOT,
          stdio: "pipe",
          timeout: 280_000,
          // Vitest sets NODE_ENV=test and Vite respects an already-set NODE_ENV,
          // which would build with import.meta.env.PROD=false (no SW registration
          // in the shell). A real `npm run build` has NODE_ENV unset, so Vite
          // defaults it to production — force that here to test the real build.
          env: { ...process.env, NODE_ENV: "production", FORCE_COLOR: "0" },
        });
      } catch (error) {
        const failed = error as { stdout?: Buffer; stderr?: Buffer };
        const output = [failed.stdout?.toString(), failed.stderr?.toString()]
          .filter((part) => part && part.length > 0)
          .join("\n");
        throw new Error(`npm run build failed:\n${output || String(error)}`);
      }
      for (const rel of [
        "dist/client/sw.js",
        "dist/client/index.html",
        "dist/client/manifest.webmanifest",
      ]) {
        expect(existsSync(`${APP_ROOT}/${rel}`), `${rel} emitted`).toBe(true);
      }
      // One document language, one viewport (vike-react's default viewport is
      // suppressed in +config; a regression would emit a duplicate tag).
      const html = readFileSync(`${APP_ROOT}/dist/client/index.html`, "utf8");
      expect(html).toContain('<html lang="en-US"');
      expect(html.match(/<meta name="viewport"/g)).toHaveLength(1);
    },
  );
});

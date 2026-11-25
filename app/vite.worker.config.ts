/**
 * Worker-only Vite config (the preview Worker + the cutover's
 * foundation): the SAME app plugins as vite.config.ts (vike, react, the
 * machine-files build plugin) plus @cloudflare/vite-plugin, building the
 * client to dist-worker/client and the Worker entry
 * (server/worker.ts) to dist-worker/worker/index.js.
 *
 * Additive by design: the main build (vite.config.ts → dist/) is
 * untouched — this file, `npm run build:worker`, and dist-worker/ are a
 * separate path. The plugin reads wrangler.preview.jsonc for bindings
 * but takes its worker SOURCE from the config override below (the
 * committed file's `main` points at the BUILT bundle, for
 * `wrangler deploy -c wrangler.preview.jsonc`). The worker builds as
 * its own `worker` environment: Vike keeps its default `ssr`
 * environment (its Node-style output under dist-worker/server/ is the
 * prerender source — build scratch, never deployed), and the plugin
 * bundles the worker entry + the Vike runtime into dist-worker/worker/.
 */
import vike from "vike/plugin";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import { machineFilesPlugin } from "./scripts/vite-plugin-machine-files";
import { ogAssetsPlugin } from "./scripts/vite-plugin-og-assets";

export default defineConfig({
  plugins: [
    vike(),
    react(),
    machineFilesPlugin(),
    ogAssetsPlugin(),
    cloudflare({
      configPath: "./wrangler.preview.jsonc",
      // Build-only: the plugin bundles the worker from source, while the
      // committed config's `main` names the built output for deploy.
      config: { main: "./server/worker.ts" },
      viteEnvironment: { name: "worker" },
    }),
  ],
  build: { outDir: "dist-worker" },
  environments: {
    client: {
      build: { outDir: "dist-worker/client" },
    },
    worker: {
      // A server-side environment (the server-entry + assets-manifest
      // machinery keys off consumer !== "client").
      consumer: "server",
      build: {
        outDir: "dist-worker/worker",
        rollupOptions: {
          // Stable entry names: the committed Wrangler config deploys
          // dist-worker/worker/index.js (the plugin's entry chunk keeps
          // its `index` name; Vike's injected server entries keep
          // theirs; wrangler bundles from main at deploy time).
          output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js" },
          // The engine .wasm imports stay external: wrangler bundles
          // them as precompiled WASM modules (workerd cannot compile
          // WASM dynamically, so they must survive Vite untouched).
          external: [/\.wasm$/],
        },
      },
    },
  },
});

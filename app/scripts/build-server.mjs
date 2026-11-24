// Bundles the Node preview/test server (server/serve.ts, TypeScript) to
// dist-server/serve.mjs, run by `npm run serve` and the Slice 3 contract
// suite. esbuild is already a devDependency (the SW build uses it).
//
// `vike/server` stays external: at runtime (from the app root, after
// `npm run build`) it resolves the built app in dist/server. satori and
// @resvg/resvg-js stay external too: the renderer loads its .wasm beside
// the installed package, which bundling would break.
import { buildSync } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

mkdirSync(join(root, "dist-server"), { recursive: true });
mkdirSync(join(root, "dist-server", "fonts"), { recursive: true });
for (const font of ["fraunces-og.ttf", "geist-regular.ttf"]) {
  copyFileSync(join(root, "src", "og", "fonts", font), join(root, "dist-server", "fonts", font));
}

buildSync({
  entryPoints: [join(root, "server", "serve.ts")],
  outfile: join(root, "dist-server", "serve.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["vike", "vike/server", "satori", "@resvg/resvg-js"],
  logLevel: "warning",
});

console.log("dist-server/serve.mjs");

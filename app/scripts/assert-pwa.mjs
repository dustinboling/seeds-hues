// Post-build PWA proof (runs as `postbuild`, and therefore inside every
// `npm run build`, including the build test in the verify gate). Fails the
// build unless: the SW is emitted with an injected precache manifest, the icon
// files the manifest names exist, and the shell HTML carries the registration
// code plus the manifest/theme-color/preload wiring.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import {
  checkManifestJson,
  htmlHasHeadWiring,
  htmlHasRegistration,
  missingManifestIcons,
  swLooksInjected,
} from "./pwa-assertions.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = join(root, "dist/client");

const dir = mkdtempSync(join(tmpdir(), "assert-pwa-"));
let values;
try {
  const outfile = join(dir, "entry.cjs");
  buildSync({
    entryPoints: [join(root, "scripts/entries/assert-pwa.entry.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "warning",
  });
  values = await import(pathToFileURL(outfile).href);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const failures = [];
const read = (rel) => {
  const path = join(clientDir, rel);
  if (!existsSync(path)) {
    failures.push(`${rel} was not emitted`);
    return null;
  }
  return readFileSync(path, "utf8");
};

// 1. The service worker is emitted with an injected precache manifest.
const swText = read("sw.js");
if (swText !== null && !swLooksInjected(swText, { precachedUrl: "manifest.webmanifest" })) {
  failures.push("sw.js has no injected precache manifest (want precache entries + skipWaiting)");
}

// 2. The manifest is emitted, valid, and its icons exist.
const manifestText = read("manifest.webmanifest");
if (manifestText !== null) {
  let manifest = null;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    failures.push("manifest.webmanifest is not valid JSON");
  }
  if (manifest !== null) {
    const problem = checkManifestJson(manifest, {
      name: values.APP_NAME,
      short_name: values.APP_SHORT_NAME,
      description: values.SITE_DESCRIPTION,
      theme_color: values.THEME_COLOR,
      background_color: values.BACKGROUND_COLOR,
    });
    if (problem) failures.push(problem);
    else {
      const missing = missingManifestIcons(manifest, (src) => existsSync(join(clientDir, src)));
      for (const src of missing) failures.push(`manifest icon ${src} was not emitted`);
    }
  }
}

// 3. The shell HTML carries the registration code and the head wiring.
const html = read("index.html");
if (html !== null) {
  const script = values.buildRegistrationScript();
  if (!htmlHasRegistration(html, script)) {
    failures.push("index.html does not contain the SW registration code");
  }
  const [preload] = values.preloadFaces();
  const missingWiring = htmlHasHeadWiring(html, {
    themeColor: values.THEME_COLOR,
    preloadHref: preload.file,
  });
  for (const snippet of missingWiring) failures.push(`index.html is missing: ${snippet}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`PWA proof FAILED: ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PWA proof passed: sw.js emitted + injected, manifest + icons valid, shell carries registration");
}

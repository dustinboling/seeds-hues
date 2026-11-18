// Stamps a per-build version into the service worker (spec §5 P6) → public/sw.js.
// Runs automatically before `next build` (npm prebuild) and `npm run cf:build`.
import { readFileSync, writeFileSync } from "node:fs";

const version = (process.env.SW_VERSION || `${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`).replace(/[^a-zA-Z0-9._-]/g, "");
const src = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8");
writeFileSync(new URL("../public/sw.js", import.meta.url), src.replace("__SW_VERSION__", version));
console.log(`public/sw.js written (version ${version})`);

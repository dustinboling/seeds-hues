// Provenance-reproducible font sync (run manually; outputs are committed).
// Copies the pinned woff2 binaries into public/fonts/ and the OFL-1.1 text
// into src/design-system/, then prints sha256 hashes for the test record.
//   - Fraunces + Newsreader: the repo's own v2/app/fonts/*.woff2 (byte-identical).
//   - Source Sans 3: @fontsource/source-sans-3@5.3.1 (devDependency, locked),
//     latin subset, the three UI weights the tool layer renders (400/600/700).
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FONTS = [
  ["../v2/app/fonts/fraunces-var.woff2", "public/fonts/fraunces-var.woff2"],
  ["../v2/app/fonts/newsreader-var.woff2", "public/fonts/newsreader-var.woff2"],
  ["../v2/app/fonts/newsreader-var-italic.woff2", "public/fonts/newsreader-var-italic.woff2"],
  [
    "node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2",
    "public/fonts/source-sans-3-latin-400-normal.woff2",
  ],
  [
    "node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2",
    "public/fonts/source-sans-3-latin-600-normal.woff2",
  ],
  [
    "node_modules/@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2",
    "public/fonts/source-sans-3-latin-700-normal.woff2",
  ],
  ["node_modules/@fontsource/source-sans-3/LICENSE", "src/design-system/OFL-1.1.txt"],
];

mkdirSync(join(root, "public/fonts"), { recursive: true });
for (const [from, to] of FONTS) {
  const src = join(root, from);
  const dest = join(root, to);
  copyFileSync(src, dest);
  const bytes = readFileSync(dest);
  const sha = createHash("sha256").update(bytes).digest("hex");
  console.log(`${to}  ${bytes.length} bytes  sha256:${sha}`);
}

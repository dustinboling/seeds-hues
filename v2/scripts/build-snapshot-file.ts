/**
 * One-off: build the next catalog snapshot FILE only (no upload, no publish row anywhere).
 * Mirrors scripts/publish-catalog.ts, but pins VERSION (below) and the PRODUCTION publish
 * history inside the file (the local DB's own history restarted at v1 after a re-import).
 * The caller uploads the file to R2 and inserts the prod catalog_publish row via SQL —
 * the same manual path the v6 publish used (sandbox cannot cross the egress proxy to R2/D1
 * through the platform proxy). Prints sha256 + published_at for the SQL step.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createDb } from "@/lib/db/client";
import { readSnapshotRows } from "@/lib/repositories/snapshot";
import { buildSnapshotFile } from "./publish-catalog";
import { openPlatform, parseArgs } from "./lib/platform";

const VERSION = 9;
const KEY = `snapshots/catalog-v${VERSION}.sqlite`;
const HISTORY = [
  { version: 1, snapshot_key: "snapshots/catalog-v1.sqlite", published_at: "2026-11-16T19:04:31.957Z" },
  { version: 2, snapshot_key: "snapshots/catalog-v2.sqlite", published_at: "2026-11-16T19:45:39.309Z" },
  { version: 3, snapshot_key: "snapshots/catalog-v3.sqlite", published_at: "2026-11-16T20:31:33.000Z" },
  { version: 4, snapshot_key: "snapshots/catalog-v4.sqlite", published_at: "2026-11-17T02:52:08.000Z" },
  { version: 5, snapshot_key: "snapshots/catalog-v5.sqlite", published_at: "2026-11-17T04:08:40.000Z" },
  { version: 6, snapshot_key: "snapshots/catalog-v6.sqlite", published_at: "2026-11-17T07:02:54.735Z" },
  { version: 7, snapshot_key: "snapshots/catalog-v7.sqlite", published_at: "2026-11-18T01:32:04.023Z" },
  { version: 8, snapshot_key: "snapshots/catalog-v8.sqlite", published_at: "2026-11-18T02:10:05.474Z" },
];

async function main() {
  const publishedAt = new Date().toISOString();
  const proxy = await openPlatform(parseArgs());
  try {
    const db = createDb(proxy.env.DB);
    const rows = await readSnapshotRows(db);
    rows.catalog_publish = [...HISTORY, { version: VERSION, snapshot_key: KEY, published_at: publishedAt }];
    const out = resolve(`tmp/catalog-v${VERSION}.sqlite`);
    mkdirSync(dirname(out), { recursive: true });
    const counts = buildSnapshotFile(out, rows, VERSION);
    const bytes = readFileSync(out);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    console.log(`Snapshot v${VERSION} built: ${bytes.length} bytes sha256 ${sha256}`);
    console.log(`published_at=${publishedAt}`);
    for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(22)} ${n}`);
    writeFileSync(resolve(`tmp/catalog-v${VERSION}.meta.json`), JSON.stringify({ version: VERSION, key: KEY, publishedAt, sha256, bytes: bytes.length, counts }, null, 2));
  } finally {
    await proxy.dispose();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

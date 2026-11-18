/**
 * Publish the catalog (FINAL spec §3.3, X12 — the version bumps on PUBLISH, not on write).
 *
 *   npm run db:publish:local                    # local D1 + local R2 (.wrangler/state/v3)
 *   tsx scripts/publish-catalog.ts --out tmp/catalog.sqlite     # also keep a local copy
 *   tsx scripts/publish-catalog.ts --dry-run    # build + verify the snapshot, change nothing
 *   tsx scripts/publish-catalog.ts --remote --config wrangler.remote.jsonc
 *
 * Steps: (1) read the current published version, (2) build a SQLite file holding ONLY the
 * allowlisted public tables, (3) upload it to R2 (SNAPSHOTS) as snapshots/catalog-v{N}.sqlite,
 * (4) insert the catalog_publish row for version N. Node-side only (node:sqlite) — never bundled
 * into the Worker.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDb } from "@/lib/db/client";
import { allPublishes, insertPublish, latestPublish, latestPublishedBatch } from "@/lib/repositories/catalog-write";
import { readSnapshotRows } from "@/lib/repositories/snapshot";
import { SNAPSHOT_ALLOWLIST, snapshotDdl } from "@/lib/repositories/snapshot-allowlist";
import { openPlatform, parseArgs } from "./lib/platform";

export function buildSnapshotFile(
  path: string,
  rows: Record<string, Record<string, unknown>[]>,
  version: number,
): Record<string, number> {
  const db = new DatabaseSync(path);
  const counts: Record<string, number> = {};
  try {
    db.exec("PRAGMA journal_mode = DELETE");
    db.exec("BEGIN");
    for (const t of SNAPSHOT_ALLOWLIST) {
      db.exec(snapshotDdl(t));
      const data = rows[t.name] ?? [];
      counts[t.name] = data.length;
      if (data.length === 0) continue;
      const cols = Object.keys(data[0]!);
      const stmt = db.prepare(
        `INSERT INTO "${t.name}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      );
      for (const r of data) stmt.run(...cols.map((c) => r[c] as string | number | null));
    }
    db.exec('CREATE INDEX "varieties_slug_idx" ON "varieties" ("slug")');
    db.exec('CREATE INDEX "sellers_slug_idx" ON "sellers" ("slug")');
    db.exec('CREATE INDEX "listings_variety_idx" ON "listings" ("variety_id")');
    db.exec('CREATE INDEX "packets_listing_idx" ON "listing_packet_sizes" ("listing_id")');
    db.exec(`PRAGMA user_version = ${Number(version)}`);
    db.exec("COMMIT");
    db.exec("VACUUM");
  } finally {
    db.close();
  }
  return counts;
}

async function main() {
  const args = parseArgs();
  const dryRun = args.flags.has("dry-run");
  const proxy = await openPlatform(args);
  const work = mkdtempSync(join(tmpdir(), "seeds-snapshot-"));
  try {
    const db = createDb(proxy.env.DB);
    const batch = await latestPublishedBatch(db);
    if (!batch) throw new Error("No published import batch — run the importer first (npm run db:import:local).");
    const current = await latestPublish(db);
    const version = (current?.version ?? 0) + 1;
    const key = `snapshots/catalog-v${version}.sqlite`;
    const publishedAt = new Date().toISOString();
    console.log(`Current catalog version: ${current?.version ?? 0} → publishing version ${version} (batch ${batch.label})`);

    const rows = await readSnapshotRows(db);
    const previous = (await allPublishes(db)).map((p) => ({
      version: p.version,
      snapshot_key: p.snapshotKey,
      published_at: p.publishedAt,
    }));
    rows.catalog_publish = [...previous, { version, snapshot_key: key, published_at: publishedAt }];

    const file = join(work, `catalog-v${version}.sqlite`);
    const counts = buildSnapshotFile(file, rows, version);
    const bytes = readFileSync(file);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    console.log(`Snapshot built: ${bytes.length} bytes, sha256 ${sha256.slice(0, 16)}…`);
    for (const [t, n] of Object.entries(counts)) console.log(`  ${t.padEnd(22)} ${n}`);

    const out = args.values.get("out");
    if (out) {
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(resolve(out), bytes);
      console.log(`Local copy written to ${out}`);
    }
    if (dryRun) {
      console.log("--dry-run: nothing uploaded, no version bump.");
      return;
    }
    await proxy.env.SNAPSHOTS.put(key, bytes, {
      httpMetadata: { contentType: "application/vnd.sqlite3" },
      customMetadata: { version: String(version), sha256, batch: batch.label },
    });
    console.log(`Uploaded to R2 SNAPSHOTS/${key}`);
    await insertPublish(db, { version, batchId: batch.id, snapshotKey: key, publishedAt });
    console.log(`✓ catalog_publish version ${version} recorded — /api/v1/catalog/version now reports ${version}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
    await proxy.dispose();
  }
}

if (process.argv[1] && /publish-catalog\.ts$/.test(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? `✗ ${err.message}` : err);
    process.exit(1);
  });
}

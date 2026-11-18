/**
 * Builds lib/data/zip-zones.json — the self-hosted ZIP → USDA Plant Hardiness Zone table used by
 * lookupZone() (lib/data/zones.ts). Source: the 2023 USDA Plant Hardiness Zone Map ZIP-code
 * listings published by the PRISM Group at Oregon State University (half-zones, e.g. "8b"):
 *
 *   https://prism.oregonstate.edu/phzm/data/2023/phzm_{us,ak,hi,pr}_zipcode_2023.csv
 *
 *   tsx scripts/gen-zip-zones.ts                 # download the four CSVs and rebuild
 *   tsx scripts/gen-zip-zones.ts --dir <folder>  # use already-downloaded CSVs (same file names)
 *
 * The zone values are copied verbatim (never altered or re-derived); only the encoding is
 * compacted: per zone, the sorted ZIPs as base-36 deltas. Runs in Node only — never bundled.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BOT_USER_AGENT } from "@/lib/config";
import { parseArgs } from "./lib/platform";

const BASE = "https://prism.oregonstate.edu/phzm/data/2023";
const FILES = ["us", "ak", "hi", "pr"].map((r) => `phzm_${r}_zipcode_2023.csv`);
const ZONE = /^(?:[1-9]|1[0-3])[ab]$/;

async function load(name: string, dir: string | undefined): Promise<string> {
  if (dir) return readFile(join(dir, name), "utf8");
  const res = await fetch(`${BASE}/${name}`, { headers: { "User-Agent": BOT_USER_AGENT } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const args = parseArgs();
  const dir = args.values.get("dir");
  const byZip = new Map<string, string>();
  for (const name of FILES) {
    const lines = (await load(name, dir)).split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines[0]?.split(",")[0] !== "zipcode") throw new Error(`${name}: unexpected header ${lines[0]}`);
    for (const line of lines.slice(1)) {
      const [zip, zone] = line.split(",");
      if (!zip || !/^\d{5}$/.test(zip) || !zone || !ZONE.test(zone)) throw new Error(`${name}: bad row ${line}`);
      const prev = byZip.get(zip);
      if (prev && prev !== zone) throw new Error(`${zip} has two zones (${prev}, ${zone})`);
      byZip.set(zip, zone);
    }
  }
  const zones: Record<string, string> = {};
  const grouped = new Map<string, number[]>();
  for (const [zip, zone] of byZip) grouped.set(zone, [...(grouped.get(zone) ?? []), Number(zip)]);
  for (const zone of [...grouped.keys()].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))) {
    const zips = grouped.get(zone)!.sort((a, b) => a - b);
    let prev = 0;
    zones[zone] = zips
      .map((z) => {
        const d = z - prev;
        prev = z;
        return d.toString(36);
      })
      .join(",");
  }
  const out = {
    source: "USDA Plant Hardiness Zone Map (2023), ZIP-code listings by the PRISM Group, Oregon State University",
    url: "https://prism.oregonstate.edu/phzm/",
    edition: "2023",
    count: byZip.size,
    encoding: "per zone: sorted ZIP codes as comma-separated base-36 deltas",
    zones,
  };
  await writeFile("lib/data/zip-zones.json", `${JSON.stringify(out)}\n`);
  console.log(`✓ lib/data/zip-zones.json — ${byZip.size} ZIP codes in ${Object.keys(zones).length} half-zones`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

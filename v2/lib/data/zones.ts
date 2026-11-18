/**
 * ZIP → USDA Plant Hardiness Zone (2023 map, half-zones such as "8b"). The ONE derivation path
 * for a gardener's zone: signup uses it now, the Phase 4 ZIP box reuses it. Data is the
 * self-hosted table in lib/data/zip-zones.json (built by scripts/gen-zip-zones.ts from the PRISM
 * / Oregon State University ZIP listings) — no external lookup at runtime.
 *
 * Privacy: a ZIP is account data and is never rendered publicly; only the derived zone may
 * surface in personalized UI.
 */
import data from "./zip-zones.json";

export const ZIP_PATTERN = /^\d{5}$/;

let table: Map<string, string> | null = null;

function decode(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [zone, encoded] of Object.entries(data.zones as Record<string, string>)) {
    let zip = 0;
    for (const d of encoded.split(",")) {
      zip += parseInt(d, 36);
      m.set(String(zip).padStart(5, "0"), zone);
    }
  }
  return m;
}

/** The USDA zone for a 5-digit ZIP, or null when the ZIP is malformed or not in the dataset. */
export function lookupZone(zip: string): string | null {
  const z = zip.trim();
  if (!ZIP_PATTERN.test(z)) return null;
  table ??= decode();
  return table.get(z) ?? null;
}

export const ZONE_DATA_SOURCE = { label: data.source, url: data.url, edition: data.edition, count: data.count } as const;

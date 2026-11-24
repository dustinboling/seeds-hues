import { shopLocationsName } from "@/lib/shop-browse";
import type { SellerLocation } from "@/lib/validators";

/** The three kind labels, verbatim (COPY-LOCATIONS §2). */
const KIND_LABELS = {
  physical: "Physical address",
  warehouse: "Warehouse address",
  mailing: "Mailing address",
} as const;

/**
 * The Locations area (seller-as-shop, SPEC-LOCATIONS §§3–5): the seller's qualifying
 * recorded locations, in §5.2 order (primary first, then kind, then state, then city).
 * Renders if and only if the seller carries ≥ 2 qualifying locations including the
 * primary — otherwise nothing renders at all: no section, no heading, no empty
 * landmark, no reserved space, no absence copy.
 *
 * Static server-rendered content: no interactive element of any kind, no tab semantics
 * (Ada L-A1's binding prohibition), state names as text only — no StateShape outline,
 * no state link (UI-LOCATIONS §5). Address lines verbatim as published. The kind label
 * and the Primary marker are real DOM text, never generated content.
 */
export function SellerLocations({ name, locations }: { name: string; locations: SellerLocation[] }) {
  const primary = locations.find((l) => l.isPrimary);
  if (!primary || locations.length < 2) return null;
  return (
    <section aria-labelledby="seller-locations" className="mt-6 max-w-3xl">
      <h2 id="seller-locations" className="text-xl font-semibold">
        {shopLocationsName(name)}
      </h2>
      <ul className="mt-2 flex flex-col gap-4">
        {locations.map((l) => (
          <li key={`${l.kind}|${l.street ?? ""}|${l.city}|${l.state}|${l.zip ?? ""}|${l.isPrimary ? "primary" : "extra"}`}>
            <p className="text-sm font-semibold">
              <span className="text-ink-soft">{KIND_LABELS[l.kind]}</span>
              {l.isPrimary ? (
                <>
                  <span className="text-muted"> · </span>
                  <span className="text-leaf">Primary</span>
                </>
              ) : null}
            </p>
            <p className="mt-1">
              {l.street ? <span className="block">{l.street}</span> : null}
              <span className="block">
                {l.city}, {l.state}
                {l.zip ? ` ${l.zip}` : ""}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { shopLocationsName } from "../../lib/shop-browse";
import type { ApiSellerLocation } from "../../data/types";

/** The three kind labels, verbatim. */
const KIND_LABELS = {
  physical: "Physical address",
  warehouse: "Warehouse address",
  mailing: "Mailing address",
} as const;

/**
 * The Locations area: the seller's qualifying recorded locations, in §5.2
 * order (primary first, then kind, then state, then city). Renders if and
 * only if the seller carries ≥ 2 qualifying locations including the
 * primary — otherwise nothing renders at all: no section, no heading, no
 * empty landmark, no reserved space, no absence copy. Ported from v2's
 * SellerLocations.
 *
 * Static server-rendered content: no interactive element of any kind, no
 * tab semantics, state names as text only — no state link. Address lines
 * verbatim as published. The kind label and the Primary marker are real
 * DOM text, never generated content.
 */
export function SellerLocations({ name, locations }: { name: string; locations: ApiSellerLocation[] }) {
  const primary = locations.find((l) => l.isPrimary);
  if (!primary || locations.length < 2) return null;
  return (
    <section aria-labelledby="seller-locations" className="seller-locations">
      <h2 id="seller-locations" className="seller-locations-heading">
        {shopLocationsName(name)}
      </h2>
      <ul className="seller-locations-list">
        {locations.map((l) => (
          <li key={`${l.kind}|${l.street ?? ""}|${l.city}|${l.state}|${l.zip ?? ""}|${l.isPrimary ? "primary" : "extra"}`}>
            <p className="seller-location-kind">
              <span className="seller-location-kind-label">{KIND_LABELS[l.kind]}</span>
              {l.isPrimary ? (
                <>
                  <span className="seller-location-sep"> · </span>
                  <span className="seller-location-primary">Primary</span>
                </>
              ) : null}
            </p>
            <p className="seller-location-address">
              {l.street ? <span className="seller-location-street">{l.street}</span> : null}
              <span className="seller-location-city">
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

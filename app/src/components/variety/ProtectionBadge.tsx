import { ProtectionIcon } from "../icons";
import type { ApiVarietyDetail } from "../../data/types";

const LABELS: Record<string, string> = {
  pvp_us: "US Plant Variety Protection",
  utility_patent_us: "US utility patent",
  pbr: "Plant Breeders’ Rights",
};

/**
 * The protection field: render ONLY when protection is a positive, sourced
 * claim. `unknown` / `none_stated` render nothing — the site never claims a
 * variety is "not protected". Ported from
 * v2/components/variety/ProtectionBadge.tsx. Non-interactive: no link,
 * button or tooltip. The label text carries the meaning alone; the icon is
 * aria-hidden.
 */
export function ProtectionBadge({ protection, note }: { protection: ApiVarietyDetail["protection"]; note: string | null }) {
  const label = LABELS[protection];
  if (!label || !note) return null;
  return (
    <p className="badge-notice">
      <span className="badge-notice-label">
        <ProtectionIcon />
        {label}
      </span>
      <span className="badge-notice-note">{note}</span>
    </p>
  );
}

export function showsProtection(protection: ApiVarietyDetail["protection"], note: string | null): boolean {
  return Boolean(LABELS[protection] && note);
}

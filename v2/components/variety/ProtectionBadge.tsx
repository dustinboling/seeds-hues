import { ProtectionIcon } from "@/components/layout/icons";
import type { VarietyDetail } from "@/lib/validators";

const LABELS: Record<string, string> = {
  pvp_us: "US Plant Variety Protection",
  utility_patent_us: "US utility patent",
  pbr: "Plant Breeders’ Rights",
};

/**
 * FINAL §1.3 "Protection field": render ONLY when protection is a positive, sourced claim.
 * `unknown` / `none_stated` render nothing — the site never claims a variety is "not protected".
 *
 * Dressed in the catalog's paper-and-ink register (Tranche 2.2, SPEC §3.5): the
 * .badge-notice block (paper-deep ground, full-strength ink-soft border, control
 * radius) with the seal icon before the label. Non-interactive: no link, button
 * or tooltip. The label text carries the meaning alone; the icon is aria-hidden.
 */
export function ProtectionBadge({ protection, note }: { protection: VarietyDetail["protection"]; note: string | null }) {
  const label = LABELS[protection];
  if (!label || !note) return null;
  return (
    <p className="badge-notice px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-ink">
        <ProtectionIcon className="size-4" />
        {label}
      </span>
      <span className="text-ink-soft">{note}</span>
    </p>
  );
}

export function showsProtection(protection: VarietyDetail["protection"], note: string | null): boolean {
  return Boolean(LABELS[protection] && note);
}

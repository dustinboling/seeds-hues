import type { VarietyDetail } from "@/lib/validators";

const LABELS: Record<string, string> = {
  pvp_us: "US Plant Variety Protection",
  utility_patent_us: "US utility patent",
  pbr: "Plant Breeders’ Rights",
};

/**
 * FINAL §1.3 "Protection field": render ONLY when protection is a positive, sourced claim.
 * `unknown` / `none_stated` render nothing — the site never claims a variety is "not protected".
 */
export function ProtectionBadge({ protection, note }: { protection: VarietyDetail["protection"]; note: string | null }) {
  const label = LABELS[protection];
  if (!label || !note) return null;
  return (
    <p className="inline-flex flex-col rounded-inner border border-petal bg-petal-50 px-3 py-2 text-sm">
      <span className="font-semibold text-petal">{label}</span>
      <span className="text-muted">{note}</span>
    </p>
  );
}

export function showsProtection(protection: VarietyDetail["protection"], note: string | null): boolean {
  return Boolean(LABELS[protection] && note);
}

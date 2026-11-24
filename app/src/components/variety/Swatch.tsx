/**
 * The variety color chip: a flat sourced hex, the Mixed conic gradient, or
 * the neutral hatched placeholder when there is no color to show (never an
 * invented color). Ported from v2/components/ui/Swatch.tsx. Callers resolve
 * through resolveColorChip — this component only draws the resolved chip.
 * Pure CSS — no image requests.
 */
import { MIX_GRADIENT, type ColorChip } from "../../lib/color-chip";

export function Swatch({ chip, size = "md", label }: { chip: ColorChip; size?: "sm" | "md" | "lg"; label?: string }) {
  const frame = `swatch swatch-${size}`;
  if (chip.kind === "none") {
    return (
      <span
        className={frame}
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, var(--sys-color-bg-deep) 0 4px, var(--sys-color-surface) 4px 8px)",
        }}
        role="img"
        aria-label={label ? `${label}: no color on file` : "No color on file"}
      />
    );
  }
  if (chip.kind === "gradient") {
    return (
      <span
        className={frame}
        style={{ backgroundImage: MIX_GRADIENT }}
        role="img"
        aria-label={label ? `${label}: mixed colors` : "Mixed colors"}
      />
    );
  }
  return (
    <span
      className={frame}
      style={{ backgroundColor: chip.hex }}
      role="img"
      aria-label={label ? `${label}: color swatch ${chip.hex}` : `Color swatch ${chip.hex}`}
    />
  );
}

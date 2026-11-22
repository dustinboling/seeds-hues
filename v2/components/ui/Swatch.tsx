/**
 * The variety color chip: a flat sourced hex, the Mixed conic gradient, or the neutral
 * hatched placeholder when there is no color to show (never an invented color, §6.2 N3).
 * Callers resolve through resolveColorChip (lib/color-chip) — this component only draws
 * the resolved chip. Pure CSS — no image requests.
 */
import { MIX_GRADIENT, type ColorChip } from "@/lib/color-chip";

export function Swatch({ chip, size = "md", label }: { chip: ColorChip; size?: "sm" | "md" | "lg"; label?: string }) {
  const dim = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-16 w-16" }[size];
  const frame = `${dim} inline-block shrink-0 rounded-full border border-line-strong`;
  if (chip.kind === "none") {
    return (
      <span
        className={frame}
        style={{
          backgroundImage: "repeating-linear-gradient(45deg, #f0e5cb 0 4px, #fffdf6 4px 8px)",
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

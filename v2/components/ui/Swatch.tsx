/**
 * Colour swatch from the variety's sourced hex. NULL → neutral hatched placeholder (never an
 * invented colour, §6.2 N3). Pure CSS — no image requests.
 */
export function Swatch({
  hex,
  size = "md",
  label,
}: {
  hex: string | null;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dim = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-16 w-16" }[size];
  if (!hex) {
    return (
      <span
        className={`${dim} inline-block shrink-0 rounded-full border border-line-strong`}
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #f0e5cb 0 4px, #fffdf6 4px 8px)",
        }}
        role="img"
        aria-label={label ? `${label}: no colour on file` : "No colour on file"}
      />
    );
  }
  return (
    <span
      className={`${dim} inline-block shrink-0 rounded-full border border-line-strong`}
      style={{ backgroundColor: hex }}
      role="img"
      aria-label={label ? `${label}: colour swatch ${hex}` : `Colour swatch ${hex}`}
    />
  );
}

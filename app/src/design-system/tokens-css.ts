/**
 * Renders the token mirror as CSS custom properties. The committed
 * `tokens.css` is this module's output; the freshness test fails on any drift,
 * so the stylesheet can never silently diverge from the mapping.
 */
import { compAliases, compValue, sysSlots, sysValue } from "./tokens";
import compJson from "./tokens/tokens.comp.json";

function varName(token: string): string {
  return `--${token.replace(/\./g, "-")}`;
}

function compDeclaration(alias: string): string {
  // Comp aliases that point at a sys slot stay symbolic (var()) so the layer
  // structure survives into the stylesheet; literals render as raw values.
  const entry = compValue(alias);
  const sysTarget = compSysTarget(alias);
  if (sysTarget) return `var(${varName(sysTarget)}) /* ${entry} */`;
  return entry;
}

// Re-read the comp entry's sys pointer without re-resolving (tokens.ts owns resolution).
function compSysTarget(alias: string): string | null {
  const table = compJson as unknown as Record<string, { sys?: string }>;
  const entry = table[alias];
  return entry?.sys ?? null;
}

/** Render the full committed tokens.css. Deterministic: file order, no timestamps. */
export function renderTokensCss(): string {
  const lines: string[] = [
    "/* Generated from the token mirror — do not edit by hand. Run `npm run gen:tokens-css`. */",
    ":root {",
  ];
  for (const slot of sysSlots()) {
    lines.push(`  ${varName(slot)}: ${sysValue(slot)};`);
  }
  lines.push("", "  /* comp layer (symbolic over sys; literals are live literals from globals.css) */");
  for (const alias of compAliases()) {
    lines.push(`  ${varName(alias)}: ${compDeclaration(alias)};`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

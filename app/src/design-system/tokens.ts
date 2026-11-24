/**
 * Typed access to the slice-1 @hues mirror (ref → sys → theme.seeds → comp).
 * The JSON files under ./tokens/ are the data; this module resolves them with
 * strict errors so a silent token miss can never render as an unstyled surface.
 * When the registry packages land, this module re-exports @hues/tokens (SWAP.md).
 */
import compJson from "./tokens/tokens.comp.json";
import mappingJson from "./token-mapping.json";
import refJson from "./tokens/tokens.ref.json";
import sysJson from "./tokens/tokens.sys.json";
import themeJson from "./tokens/theme.seeds.json";

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenError";
  }
}

export interface TokenRef {
  value: string;
  note: string;
}

export interface RefLayer {
  design: Record<string, TokenRef>;
  seeds: Record<string, TokenRef>;
}

export interface SysSlot {
  ref: string;
  ruled?: boolean;
  provisional?: boolean;
}

export interface ThemeEntry {
  value: string;
  from: string;
  provisional?: boolean;
  note: string;
}

export interface CompEntry {
  sys?: string;
  literal?: string;
  live: string;
}

export interface MappingEntry {
  seeds: string;
  sourceValue: string;
  status: "mapped" | "replaced";
  layer: "sys";
  hues: string;
  huesRef: string | null;
  huesRefValue: string | null;
  themeValue: string;
  note: string;
}

const refs = refJson as unknown as RefLayer;
const sys = sysJson as unknown as Record<string, SysSlot>;
const theme = themeJson as unknown as Record<string, ThemeEntry>;
const comp = compJson as unknown as Record<string, CompEntry>;
const mapping = (mappingJson as unknown as { entries: MappingEntry[] }).entries;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolve a `<namespace>.<name>` ref (e.g. `design.seeds-ground`) to its raw value. */
export function refValue(ref: string): string {
  const dot = ref.indexOf(".");
  if (dot <= 0) throw new TokenError(`Malformed ref "${ref}" (want "<namespace>.<name>").`);
  const namespace = ref.slice(0, dot);
  const name = ref.slice(dot + 1);
  const group: Record<string, TokenRef> | undefined =
    namespace === "design" ? refs.design : namespace === "seeds" ? refs.seeds : undefined;
  if (!group || !isRecord(group)) throw new TokenError(`Unknown ref namespace "${namespace}" in "${ref}".`);
  const entry = group[name];
  if (!entry) throw new TokenError(`Unknown ref "${ref}".`);
  return entry.value;
}

/** Resolve a `sys.*` slot to the value seeds renders (the theme.seeds layer). */
export function sysValue(slot: string): string {
  const entry = theme[slot];
  if (!entry) throw new TokenError(`Unknown sys slot "${slot}".`);
  return entry.value;
}

/** Resolve a `comp.*` alias to a concrete value (via its sys slot, or a recorded literal). */
export function compValue(alias: string): string {
  const entry = comp[alias];
  if (!entry) throw new TokenError(`Unknown comp alias "${alias}".`);
  if (entry.literal !== undefined) return entry.literal;
  if (entry.sys !== undefined) return sysValue(entry.sys);
  throw new TokenError(`Comp alias "${alias}" has neither a sys slot nor a literal.`);
}

/** The full seeds → @hues mapping table (one entry per live seeds color token). */
export function mappingEntries(): MappingEntry[] {
  return mapping;
}

function tokenKeys(table: Record<string, unknown>): string[] {
  // `$`-prefixed keys are file metadata comments, not tokens.
  return Object.keys(table).filter((key) => !key.startsWith("$"));
}

/** Every sys slot the seeds theme defines. */
export function sysSlots(): string[] {
  return tokenKeys(theme);
}

/** Every comp alias the seeds theme defines. */
export function compAliases(): string[] {
  return tokenKeys(comp);
}

/** The sys layer's default ref for a slot (the design-system wiring, pre-theme). */
export function sysDefaultRef(slot: string): string {
  const entry = sys[slot];
  if (!entry) throw new TokenError(`Unknown sys slot "${slot}".`);
  return entry.ref;
}

/** The ref a theme entry resolves from (proves the from/value chain the tests check). */
export function themeFrom(slot: string): string {
  const entry = theme[slot];
  if (!entry) throw new TokenError(`Unknown sys slot "${slot}".`);
  return entry.from;
}

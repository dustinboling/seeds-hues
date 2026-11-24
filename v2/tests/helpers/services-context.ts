/**
 * Fake Services factory (refactor R2 §3): one place that builds the Services-shaped
 * fakes the suite injects. Two uses:
 *
 * 1. services/context mocks. vi.mock factories are hoisted — they cannot reference
 *    imports — so the mock itself stays the one-line hoisted-store passthrough and the
 *    fake is built here, in module scope, where imports are available:
 *
 *      const store = vi.hoisted(() => ({ services: null as unknown }));
 *      vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));
 *      import { fakeServices } from "../helpers/services-context";
 *      store.services = fakeServices({ catalog: { getSeller: async () => fake.seller } });
 *
 *    The store object identity is stable, so getServices (called at test time) sees the
 *    assignment even though the mock factory ran at import time. Each file keeps its own
 *    fake values and closures; only the Services-shaped assembly is shared.
 *
 * 2. Direct handler tests (no mocking): lib/api/handlers take Services via ApiContext,
 *    so tests call them with fakeServices({ catalog: { ... } }) outright.
 *
 * Namespace and method names are type-checked against Services (a typo'd key fails
 * typecheck); values are intentionally untyped — fakes are partial by nature.
 */
import type { Services } from "@/lib/services";

export type ServicesOverrides = {
  [K in keyof Services]?: { [M in keyof Services[K]]?: unknown };
};

export function fakeServices(overrides: ServicesOverrides = {}): Services {
  // The seller page reads the global crop vocabulary on every load (seller-as-shop:
  // ?crop= validity + remover labels), so a faked catalog answers it with the empty
  // vocabulary unless the file overrides it — behavior-neutral where ?crop= is not in
  // play, and explicit crops stay one override away.
  if (!overrides.catalog) return { ...overrides } as Services;
  const { catalog, ...rest } = overrides;
  return { catalog: { cropCatalog: async () => [], ...catalog }, ...rest } as Services;
}

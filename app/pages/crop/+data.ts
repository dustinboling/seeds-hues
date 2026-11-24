import { loadCropIndexData } from "../../src/data/load";

// https://vike.dev/data — the crop list renders from the live API through the
// shared data cache (the "crops" entry, purged by variety/seller/crop tags).
// Prerender runs this at build; the revalidate hook re-runs it after a purge.
export async function data() {
  return loadCropIndexData();
}

export type Data = Awaited<ReturnType<typeof data>>;

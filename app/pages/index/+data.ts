import { loadHomeData } from "../../src/data/load";

// https://vike.dev/data — counts, coverage, recent events, and the crop
// window render from the live API through the shared data cache. Prerender
// runs this at build so the first HTML carries current data; the revalidate
// hook purges these entries on every catalog write (Bea §9).
export async function data() {
  return loadHomeData();
}

export type Data = Awaited<ReturnType<typeof data>>;

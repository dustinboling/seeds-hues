/** TEMP PROBE (delete before finishing): browseVarieties latency breakdown. */
import { createTestD1 } from "../tests/helpers/d1";
import { createServices } from "@/lib/services";
import * as repo from "@/lib/repositories/catalog-read";
import { browseCountQueries, varietyFiltersFromBrowse, BROWSE_SORT_REPO, type BrowseFilterState } from "@/lib/browse";
import { pageWindow } from "@/lib/paging";

const state = (over: Partial<BrowseFilterState> = {}): BrowseFilterState => ({
  season: null, method: null, lifeCycle: null, hue: [], smallFarm: false, sort: "name", ...over,
});

async function main(): Promise<void> {
  const t = await createTestD1();
  try {
    const db = t.db;
    const catalog = createServices(db).catalog;
    const cases: { name: string; s: BrowseFilterState }[] = [
      { name: "plain", s: state() },
      { name: "sort=availability", s: state({ sort: "availability" }) },
      { name: "season=cool", s: state({ season: "cool" }) },
      { name: "season=cool+sort=availability", s: state({ season: "cool", sort: "availability" }) },
      { name: "life_cycle=perennial", s: state({ lifeCycle: "perennial" }) },
    ];
    for (const c of cases) {
      const vf = varietyFiltersFromBrowse(c.s);
      const queries = browseCountQueries(c.s);
      // Warm.
      await catalog.browseVarieties({ filters: c.s, page: pageWindow(1) });
      // Whole payload.
      let t0 = performance.now();
      await catalog.browseVarieties({ filters: c.s, page: pageWindow(1) });
      const whole = performance.now() - t0;
      // Rows+total+media (summaries path, same calls the service makes).
      t0 = performance.now();
      const { rows } = await repo.listVarietySummaryRows(db, vf, BROWSE_SORT_REPO[c.s.sort], pageWindow(1));
      await repo.listMediaForVarieties(db, rows.map((r) => r.id));
      const summaries = performance.now() - t0;
      // Counts fan-out.
      t0 = performance.now();
      await Promise.all(queries.map((q) => repo.countVarietyRows(db, q.filters)));
      const counts = performance.now() - t0;
      // Single-count average.
      t0 = performance.now();
      const N = 5;
      for (let i = 0; i < N; i++) await repo.countVarietyRows(db, queries[0]!.filters);
      const single = (performance.now() - t0) / N;
      console.log(
        `${c.name}: payload=${whole.toFixed(0)}ms summaries=${summaries.toFixed(0)}ms counts(${queries.length}q)=${counts.toFixed(0)}ms single-count~${single.toFixed(1)}ms`,
      );
    }
  } finally {
    await t.dispose();
  }
}

void main();

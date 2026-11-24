/**
 * Slice 2 machine files (F1/F2 cure proof at unit level): the single
 * generation path the build plugin and the revalidation regeneration both
 * call must emit robots.txt, llms.txt, the sitemap index, and all seven
 * Bea §8.2 segments — with pagination out, the zero-seller cohort separate,
 * removed rows absent, and lastmod real-or-omitted. Runs against the mutable
 * fake catalog: no network, fully deterministic.
 */
import { describe, expect, it } from "vitest";
import { generateMachineFiles } from "../../src/server/machine-files";
import { createDataCache } from "../../src/data/cache";
import { createFakeCatalogApi, fakeCatalogState, fakeLastmodCache } from "./fake-catalog";

const SITE = "https://seeds.hues.flowers";

async function generate() {
  const state = fakeCatalogState();
  const files = await generateMachineFiles({
    siteUrl: SITE,
    api: createFakeCatalogApi(state),
    cache: createDataCache(),
    lastmod: fakeLastmodCache(),
  });
  return { state, files };
}

describe("machine-file generation", () => {
  it("emits every machine file: robots, llms, index, and all seven segments", async () => {
    const { files } = await generate();
    for (const name of [
      "robots.txt",
      "llms.txt",
      "sitemap.xml",
      "sitemap-varieties-listed.xml",
      "sitemap-varieties-zero-seller.xml",
      "sitemap-sellers.xml",
      "sitemap-crops.xml",
      "sitemap-series.xml",
      "sitemap-states.xml",
      "sitemap-hubs.xml",
    ] as const) {
      expect(files[name], `${name} generated`).toBeTypeOf("string");
      expect(files[name].length, `${name} non-empty`).toBeGreaterThan(0);
    }
  });

  it("index lists exactly the seven segment files", async () => {
    const { files } = await generate();
    for (const seg of [
      "sitemap-varieties-listed.xml",
      "sitemap-varieties-zero-seller.xml",
      "sitemap-sellers.xml",
      "sitemap-crops.xml",
      "sitemap-series.xml",
      "sitemap-states.xml",
      "sitemap-hubs.xml",
    ]) {
      expect(files["sitemap.xml"]).toContain(`${SITE}/${seg}`);
    }
    expect(files["sitemap.xml"].match(/<sitemap>/g)).toHaveLength(7);
  });

  it("keeps pagination URLs out of every segment (Bea §8.2 rule 2)", async () => {
    const { files } = await generate();
    for (const [name, body] of Object.entries(files)) {
      if (!name.endsWith(".xml")) continue;
      expect(body, `${name} has no pagination URL`).not.toContain("page=");
      expect(body, `${name} has no query string`).not.toMatch(/<loc>[^<]*\?/);
    }
  });

  it("segments the variety cohorts: listed and zero-seller in their own files", async () => {
    const { files } = await generate();
    const listed = files["sitemap-varieties-listed.xml"];
    const zero = files["sitemap-varieties-zero-seller.xml"];
    expect(listed).toContain(`${SITE}/variety/sweet-pea-kings-ransom`);
    expect(listed).not.toContain("cosmos-lonely-bloom");
    expect(zero).toContain(`${SITE}/variety/cosmos-lonely-bloom`);
    expect(zero).not.toContain("sweet-pea-kings-ransom");
  });

  it("excludes non-indexable varieties and removed rows (cached but gone)", async () => {
    const { files } = await generate();
    const all = Object.values(files).join("\n");
    expect(all).not.toContain("cosmos-hidden-draft");
    expect(all).not.toContain("sweet-pea-removed-variety");
    expect(all).not.toContain("gone-seed-farm");
  });

  it("emits lastmod only for verified rows: real dates stay, stale rows omit", async () => {
    const { files } = await generate();
    const listed = files["sitemap-varieties-listed.xml"];
    // Verified (seq 20 == live seq 20): the real date emits.
    expect(listed).toContain("<lastmod>2026-11-20T00:00:00.000Z</lastmod>");
    // Stale (cached seq 9, live seq 21): no lastmod at all — never a wrong date.
    const zero = files["sitemap-varieties-zero-seller.xml"];
    expect(zero).toContain(`${SITE}/variety/cosmos-lonely-bloom`);
    expect(zero).not.toContain("<lastmod>");
    // Crops/states/hubs carry no lastmod (no trustworthy date exists).
    for (const name of ["sitemap-crops.xml", "sitemap-states.xml", "sitemap-hubs.xml"] as const) {
      expect(files[name], name).not.toContain("<lastmod>");
    }
  });

  it("derives state pages from visible sellers only", async () => {
    const { files } = await generate();
    const states = files["sitemap-states.xml"];
    expect(states).toContain(`${SITE}/state/oregon`);
    expect(states).toContain(`${SITE}/state/kansas`);
    expect(states.match(/<url>/g)).toHaveLength(2);
  });

  it("renders robots.txt with the carried posture plus the three parameter disallows", async () => {
    const { files } = await generate();
    expect(files["robots.txt"]).toContain("User-Agent: *\nAllow: /");
    for (const d of ["/*?*sort=*", "/*?*limit=*", "/*?*session=*"]) {
      expect(files["robots.txt"]).toContain(`Disallow: ${d}`);
    }
    expect(files["robots.txt"]).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  it("renders llms.txt from live counts with no prices", async () => {
    const { files } = await generate();
    expect(files["llms.txt"]).toContain("# seeds.hues.flowers");
    expect(files["llms.txt"]).toContain("3 flower seed varieties across 2 crops, sold by 2 US sellers (1 listings)");
    expect(files["llms.txt"]).toContain("No prices are shown");
    expect(files["llms.txt"]).not.toContain('"price"');
  });
});

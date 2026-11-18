/**
 * Pod-ornament delta: the plant slug → seed-pod art map, the decorative divider and the variety
 * card placeholder (pod motif for crops with art, divider stem otherwise).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { POD_ART_BY_PLANT, podArtForPlant } from "@/lib/data/pod-ornaments";
import { PodDivider } from "@/components/ui/PodDivider";
import { VarietyCardImage } from "@/components/variety/VarietyCardImage";

describe("pod ornaments", () => {
  it("maps plant slugs to art keys", () => {
    expect(Object.keys(POD_ART_BY_PLANT)).toHaveLength(14);
    expect(podArtForPlant("cornflower")).toEqual({
      motif: "/ornaments/motif-bachelor-button.webp",
      bundle: "/ornaments/bundle-bachelor-button.webp",
    });
    expect(podArtForPlant("pincushion-flower")?.motif).toBe("/ornaments/motif-scabiosa.webp");
    expect(podArtForPlant("breadseed-poppy")?.bundle).toBe("/ornaments/bundle-poppy.webp");
    expect(podArtForPlant("dahlia")).toBeUndefined();
    expect(podArtForPlant("toString")).toBeUndefined();
    expect(podArtForPlant(undefined)).toBeUndefined();
  });

  it("PodDivider is a decorative image only", () => {
    const h = renderToStaticMarkup(createElement(PodDivider, { bundle: "/ornaments/bundle-zinnia.webp", className: "mt-8" }));
    expect(h).toMatch(/^<div aria-hidden="true" data-testid="pod-divider" class="w-full mt-8"><img /);
    expect(h).toContain('src="/ornaments/bundle-zinnia.webp" alt="" width="1600" height="400" loading="lazy"');
  });

  it("card placeholder shows the pod motif when the crop has one, the divider stem otherwise", () => {
    const withArt = renderToStaticMarkup(createElement(VarietyCardImage, { media: [], varietyName: "Benary's Giant Lime", plantSlug: "zinnia" }));
    expect(withArt).toContain('data-testid="variety-card-placeholder"');
    expect(withArt).toMatch(/<img src="\/ornaments\/motif-zinnia\.webp" alt="" aria-hidden="true" width="480" height="480" loading="lazy"/);
    expect(withArt).not.toContain("divider-stem");
    const without = renderToStaticMarkup(createElement(VarietyCardImage, { media: [], varietyName: "Café au Lait", plantSlug: "dahlia" }));
    expect(without).toContain('data-testid="variety-card-placeholder"');
    expect(without).toContain('<span aria-hidden="true" class="divider-stem w-full opacity-50"></span>');
    expect(without).not.toContain("<img");
  });
});

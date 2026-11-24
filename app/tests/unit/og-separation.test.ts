/**
 * og:image separation pin (F3 cure): og:image is the share image URL and
 * never the page canonical — at the pageHead unit level and in the SeoHead
 * rendered output. The build test proves the separation on every template's
 * emitted HTML (renderToStaticMarkup needs no DOM).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeoHead } from "../../src/seo/SeoHead";
import { pageHead } from "../../src/seo/meta";

describe("og:image separation", () => {
  it("keeps og:url (canonical) and og:image (share image) as separate fields", () => {
    const tags = pageHead({ title: "About the directory", description: "d", path: "/about" });
    expect(tags.og.url).toBe("https://seeds.hues.flowers/about");
    expect(tags.og.image).toBe("https://seeds.hues.flowers/og/site/default");
    expect(tags.og.image).not.toBe(tags.og.url);
    expect(tags.twitter.image).toBe(tags.og.image);
  });

  it("renders og:image from the image field in SeoHead", () => {
    const tags = pageHead({ title: "t", description: "d", path: "/about" });
    const html = renderToStaticMarkup(SeoHead({ tags }));
    expect(html).toContain('<meta property="og:image" content="https://seeds.hues.flowers/og/site/default"/>');
    expect(html).toContain('<meta property="og:url" content="https://seeds.hues.flowers/about"/>');
  });
});

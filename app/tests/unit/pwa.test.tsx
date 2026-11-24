/**
 * PWA unit proofs: the registration snippet both the shell and the build
 * assertion share, the +Head wiring (rendered server-side), the manifest's
 * validity against site.ts, and the assertion predicates on fixtures.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Head } from "../../pages/+Head.js";
import { preloadFaces } from "../../src/design-system/fonts.js";
import { SW_URL, buildRegistrationScript } from "../../src/pwa.js";
import {
  APP_NAME,
  APP_SHORT_NAME,
  BACKGROUND_COLOR,
  SITE_DESCRIPTION,
  THEME_COLOR,
} from "../../src/site.js";
import {
  checkManifestJson,
  htmlHasHeadWiring,
  htmlHasRegistration,
  missingManifestIcons,
  swLooksInjected,
} from "../../scripts/pwa-assertions.mjs";

const PUBLIC = fileURLToPath(new URL("../../public", import.meta.url));

describe("SW registration snippet", () => {
  it("is the exact script the shell inlines and the build assertion matches", () => {
    expect(SW_URL).toBe("/sw.js");
    expect(buildRegistrationScript()).toBe(
      'if("serviceWorker" in navigator){' +
        'window.addEventListener("load",function(){' +
        'navigator.serviceWorker.register("/sw.js").catch(function(){})' +
        "})}",
    );
  });
});

describe("+Head", () => {
  const head = renderToString(<Head />);

  it("carries the manifest, theme-color, icons, and font preload", () => {
    expect(head).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(head).toContain(`<meta name="theme-color" content="${THEME_COLOR}"`);
    expect(head).toContain('<link rel="icon" href="/icons/hues-icon.svg"');
    expect(head).toContain('<link rel="apple-touch-icon" href="/icons/hues-apple-touch-icon.png"');
    const [preload] = preloadFaces();
    expect(head).toContain(`<link rel="preload" href="${preload?.file}"`);
    expect(head).toContain('name="viewport"');
    expect(head).toContain('name="color-scheme" content="light"');
  });

  it("omits the SW script outside production builds (no /sw.js in dev)", () => {
    expect(import.meta.env.PROD).toBe(false);
    expect(head).not.toContain("serviceWorker");
  });
});

describe("manifest.webmanifest", () => {
  const manifest = JSON.parse(readFileSync(`${PUBLIC}/manifest.webmanifest`, "utf8")) as unknown;

  it("matches site.ts and the PWA contract", () => {
    expect(
      checkManifestJson(manifest, {
        name: APP_NAME,
        short_name: APP_SHORT_NAME,
        description: SITE_DESCRIPTION,
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
      }),
    ).toBeNull();
  });

  it("follows the warmed ground", () => {
    expect(THEME_COLOR).toBe("#f8f6ec");
    expect(BACKGROUND_COLOR).toBe("#f8f6ec");
  });

  it("names only icons committed in public/icons", () => {
    const missing = missingManifestIcons(
      manifest as { icons: Array<{ src: string }> },
      (src) => existsSync(`${PUBLIC}${src}`),
    );
    expect(missing).toEqual([]);
  });
});

describe("assertion predicates on fixtures", () => {
  const goodManifest = {
    name: "n",
    short_name: "s",
    description: "d",
    theme_color: "#f8f6ec",
    background_color: "#f8f6ec",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "en-US",
    icons: [
      { src: "/i/any.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/i/mask.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  const expected = {
    name: "n",
    short_name: "s",
    description: "d",
    theme_color: "#f8f6ec",
    background_color: "#f8f6ec",
  };

  it("accepts a valid manifest, rejects drift", () => {
    expect(checkManifestJson(goodManifest, expected)).toBeNull();
    expect(checkManifestJson({ ...goodManifest, theme_color: "#f8f1e1" }, expected)).toContain("theme_color");
    expect(checkManifestJson({ ...goodManifest, icons: [] }, expected)).toContain("icons");
    expect(checkManifestJson(null, expected)).toContain("not a JSON object");
  });

  it("lists missing icon files", () => {
    expect(missingManifestIcons(goodManifest, () => true)).toEqual([]);
    expect(missingManifestIcons(goodManifest, (src) => src !== "/i/mask.png")).toEqual(["/i/mask.png"]);
  });

  it("detects the registration code in shell HTML", () => {
    const script = buildRegistrationScript();
    const html = `<html><head><script data-sw-register="/sw.js">${script}</script></head></html>`;
    expect(htmlHasRegistration(html, script)).toBe(true);
    expect(htmlHasRegistration("<html></html>", script)).toBe(false);
  });

  it("lists missing head wiring", () => {
    const wiring = { themeColor: "#f8f6ec", preloadHref: "/fonts/f.woff2" };
    const html =
      '<link rel="manifest" href="/manifest.webmanifest"/>' +
      '<meta name="theme-color" content="#f8f6ec"/>' +
      '<link rel="preload" href="/fonts/f.woff2"/>' +
      '<link rel="icon" href="/icons/hues-icon.svg"/>';
    expect(htmlHasHeadWiring(html, wiring)).toEqual([]);
    expect(htmlHasHeadWiring("<html></html>", wiring)).toHaveLength(4);
  });

  it("recognizes an injected service worker", () => {
    const injected = `precacheAndRoute(self.__WB_MANIFEST=[{"url":"manifest.webmanifest","revision":"abc"}]);self.skipWaiting()`;
    expect(swLooksInjected(injected, { precachedUrl: "manifest.webmanifest" })).toBe(true);
    expect(swLooksInjected("precacheAndRoute(self.__WB_MANIFEST)", { precachedUrl: "manifest.webmanifest" })).toBe(
      false,
    );
  });
});

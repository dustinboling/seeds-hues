// Pure PWA predicates shared by scripts/assert-pwa.mjs (real dist output) and
// tests/unit/pwa.test.ts (fixtures). Each check returns null on success or a
// human-readable failure string — never throws on bad input, so the assertion
// script reports every failure instead of dying on the first.

/** @param {unknown} manifest @param {{name:string;short_name:string;description:string;theme_color:string;background_color:string}} expected */
export function checkManifestJson(manifest, expected) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return "manifest is not a JSON object";
  const get = (key) => (typeof manifest[key] === "string" ? manifest[key] : null);
  for (const key of ["name", "short_name", "description", "theme_color", "background_color"]) {
    if (get(key) !== expected[key]) return `manifest.${key} is ${JSON.stringify(manifest[key])}, want ${JSON.stringify(expected[key])}`;
  }
  for (const [key, want] of [
    ["start_url", "/"],
    ["scope", "/"],
    ["display", "standalone"],
    ["lang", "en-US"],
  ]) {
    if (get(key) !== want) return `manifest.${key} is ${JSON.stringify(manifest[key])}, want ${JSON.stringify(want)}`;
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) return "manifest.icons is empty";
  for (const icon of manifest.icons) {
    if (!icon || typeof icon !== "object") return "manifest.icons holds a non-object entry";
    for (const key of ["src", "sizes", "type"]) {
      if (typeof icon[key] !== "string" || icon[key].length === 0)
        return `manifest icon ${JSON.stringify(icon.src)} is missing ${key}`;
    }
  }
  const purposes = manifest.icons.map((icon) => icon.purpose ?? "any");
  if (!purposes.includes("any")) return "manifest.icons has no purpose=any icon";
  if (!purposes.includes("maskable")) return "manifest.icons has no maskable icon";
  return null;
}

/**
 * @param {{icons:Array<{src:string}>}} manifest
 * @param {(sitePath:string)=>boolean} exists
 * @returns {string[]} icon srcs with no emitted file.
 */
export function missingManifestIcons(manifest, exists) {
  return manifest.icons.filter((icon) => !exists(icon.src)).map((icon) => icon.src);
}

/** @param {string} html @param {string} script */
export function htmlHasRegistration(html, script) {
  return html.includes(script) && html.includes('data-sw-register="/sw.js"');
}

/** @param {string} html @param {{themeColor:string;preloadHref:string}} wiring */
export function htmlHasHeadWiring(html, wiring) {
  const needs = [
    '<link rel="manifest" href="/manifest.webmanifest"',
    `<meta name="theme-color" content="${wiring.themeColor}"`,
    `<link rel="preload" href="${wiring.preloadHref}"`,
    '<link rel="icon" href="/icons/hues-icon.svg"',
  ];
  return needs.filter((snippet) => !html.includes(snippet));
}

/** @param {string} swText @param {{precachedUrl:string}} shape */
export function swLooksInjected(swText, shape) {
  return (
    swText.includes(shape.precachedUrl) && swText.includes('"revision"') && swText.includes("skipWaiting")
  );
}

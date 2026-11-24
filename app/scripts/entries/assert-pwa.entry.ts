// Re-export surface for scripts/assert-pwa.mjs: esbuild bundles this entry so
// the post-build proof reads the same values the shell renders (no duplication).
export {
  APP_NAME,
  APP_SHORT_NAME,
  BACKGROUND_COLOR,
  SITE_DESCRIPTION,
  THEME_COLOR,
} from "../../src/site.js";
export { buildRegistrationScript, SW_URL } from "../../src/pwa.js";
export { preloadFaces } from "../../src/design-system/fonts.js";

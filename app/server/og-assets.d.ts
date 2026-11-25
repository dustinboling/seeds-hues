/**
 * Types for the worker-only virtual module (scripts/vite-plugin-og-assets.ts,
 * loaded by vite.worker.config.ts only): the OG font bytes, base64, plus
 * the two precompiled engine WASM modules (bundled by wrangler as
 * modules — workerd cannot compile them dynamically). The main build
 * never resolves this module.
 */
declare module "virtual:og-assets" {
  export const geistBase64: string;
  export const frauncesBase64: string;
  export const yogaWasmModule: WebAssembly.Module;
  export const resvgWasmModule: WebAssembly.Module;
}

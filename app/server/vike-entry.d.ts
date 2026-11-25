/**
 * Types for the server-entry virtual module
 * (@brillout/vite-plugin-server-entry, loaded by vite.worker.config.ts
 * only): imported side-effect-only by server/worker.ts so Vike's
 * production entry is bundled into the worker. The main build and the
 * unit tests never resolve this module.
 */
declare module "virtual:@brillout/vite-plugin-server-entry:serverEntry";

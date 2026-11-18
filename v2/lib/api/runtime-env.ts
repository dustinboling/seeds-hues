/**
 * Non-DB Worker bindings/vars for the current request (OpenNext request context).
 * (The D1 binding is read only in lib/db/client.)
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runtimeEnvFrom, type RuntimeEnv } from "./env-config";

export { runtimeEnvFrom, type RuntimeEnv };

export async function getRuntimeEnv(): Promise<RuntimeEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return runtimeEnvFrom(env);
}

/**
 * Request-scoped service access for Server Components and route handlers. Server Components
 * call this in-process — never an HTTP self-call to /api/v1 (FINAL X2).
 */
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { getRuntimeEnv } from "@/lib/api/runtime-env";
import type { Services } from "./index";
import { servicesFor } from "./wire";

export const getServices = cache(async (): Promise<Services> => {
  const [db, env] = await Promise.all([getDb(), getRuntimeEnv()]);
  return servicesFor(db, env);
});

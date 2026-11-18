/** /api/v1/account and /api/v1/account/* — accounts, alerts, waiting lists (lib/api/account-routes.ts). */
import { ACCOUNT_ROUTES } from "@/lib/api/account-routes";
import { writeRouter } from "@/lib/api/write-route";

export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = writeRouter("/api/v1/account", ACCOUNT_ROUTES);

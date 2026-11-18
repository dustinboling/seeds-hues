import { INGEST_ROUTES } from "@/lib/api/ingest-admin-routes";
import { writeRouter } from "@/lib/api/write-route";

export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = writeRouter("/api/v1/ingest", INGEST_ROUTES);

import { apiRoute } from "@/lib/api/route";
import { openApi } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export const { GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE } = apiRoute(openApi);

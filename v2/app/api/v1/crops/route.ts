import { apiRoute } from "@/lib/api/route";
import { listCrops } from "@/lib/api/handlers";

export const dynamic = "force-dynamic";

export const { GET, HEAD, OPTIONS, POST, PUT, PATCH, DELETE } = apiRoute(listCrops);

import { loadApiDocsData } from "../../src/data/load";

// https://vike.dev/data — the endpoint inventory renders from the live
// OpenAPI document (GET /api/v1/openapi.json) through the shared data cache,
// exactly like v2 renders from its local OpenAPI builder.
export async function data() {
  return loadApiDocsData();
}

export type Data = Awaited<ReturnType<typeof data>>;

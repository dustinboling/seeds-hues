import type { ErrorCode } from "@/lib/validators";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);
export const validationError = (message: string) => new ApiError(400, "validation_error", message);

export function errorBody(code: ErrorCode, message: string) {
  return { data: null, meta: null, error: { code, message } };
}

/**
 * File: src/lib/api/ApiError.ts
 * Normalized error shape so UI code never has to special-case axios internals.
 */

import { AxiosError } from "axios";

export class ApiError extends Error {
  /** HTTP status code, or 0 for network/timeout errors. */
  status: number;
  /** Machine-readable error code from the backend, if provided. */
  code?: string;
  /** Raw payload returned by the backend, for debugging. */
  data?: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; data?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = options?.code;
    this.data = options?.data;
  }

  /** True when the request never reached the server (offline, CORS, timeout). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Convert any thrown value (axios or otherwise) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const axiosErr = error as AxiosError<any>;
  if (axiosErr?.isAxiosError) {
    const status = axiosErr.response?.status ?? 0;
    const payload = axiosErr.response?.data;
    const message =
      payload?.message ||
      payload?.error ||
      axiosErr.message ||
      "Request failed";
    return new ApiError(message, status, {
      code: payload?.code,
      data: payload,
    });
  }

  return new ApiError(
    error instanceof Error ? error.message : "Unknown error",
    0,
  );
}

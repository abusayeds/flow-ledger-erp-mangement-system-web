/**
 * File: src/hooks/useAxiosSecure.tsx
 * Backward-compatible accessor for the shared axios instance.
 *
 * The token is injected automatically by the client's request interceptor, so
 * this is identical to useAxios. Prefer `api` from "@/lib/api/client" in new code.
 */

import { api } from "../lib/api/client";

const useAxiosSecure = () => api.raw;

export default useAxiosSecure;

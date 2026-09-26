/**
 * File: src/hooks/useAxios.tsx
 * Backward-compatible accessor for the shared axios instance.
 * Prefer importing `api` from "@/lib/api/client" directly in new code.
 */

import { api } from "../lib/api/client";

const useAxiosBase = () => api.raw;

export default useAxiosBase;

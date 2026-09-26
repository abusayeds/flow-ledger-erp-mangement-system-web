/**
 * File: src/lib/queryClient.ts
 * Shared TanStack Query client with app-wide defaults.
 */

import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/ApiError";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry client errors (4xx); do retry transient/network errors.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;

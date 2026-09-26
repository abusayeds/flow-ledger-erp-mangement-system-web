/**
 * File: src/hooks/useResource.ts
 * Generic TanStack Query CRUD hooks bound to a ResourceService.
 *
 * Wiring a new entity to the data layer is ~2 lines:
 *
 *   const invoicesService = createResource<Invoice>("/invoices");
 *   export const invoiceHooks = createResourceHooks("invoices", invoicesService);
 *
 *   // in a component
 *   const { data, isLoading } = invoiceHooks.useList();
 *   const create = invoiceHooks.useCreate();
 *   create.mutate(newInvoice);
 *
 * Mutations automatically invalidate the matching list/detail caches.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { Entity, ListParams } from "../lib/api/types";
import type { ResourceService } from "../lib/api/createResource";

export function createResourceHooks<T extends Entity, TInput = Partial<T>>(
  key: string,
  service: ResourceService<T, TInput>,
) {
  const keys = {
    all: [key] as const,
    list: (params?: ListParams) => [key, "list", params ?? {}] as const,
    detail: (id: string) => [key, "detail", id] as const,
  };

  function useList(
    params?: ListParams,
    options?: Omit<UseQueryOptions<T[]>, "queryKey" | "queryFn">,
  ) {
    return useQuery<T[]>({
      queryKey: keys.list(params),
      queryFn: () => service.list(params),
      ...options,
    });
  }

  function useGet(
    id: string | undefined,
    options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
  ) {
    return useQuery<T>({
      queryKey: keys.detail(id ?? ""),
      queryFn: () => service.get(id as string),
      enabled: !!id,
      ...options,
    });
  }

  function useCreate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (payload: TInput) => service.create(payload),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useUpdate() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: TInput }) =>
        service.update(id, payload),
      onSuccess: (_data, { id }) => {
        qc.invalidateQueries({ queryKey: keys.all });
        qc.invalidateQueries({ queryKey: keys.detail(id) });
      },
    });
  }

  function useRemove() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => service.remove(id),
      onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
    });
  }

  return { keys, service, useList, useGet, useCreate, useUpdate, useRemove };
}

export type ResourceHooks<T extends Entity, TInput = Partial<T>> = ReturnType<
  typeof createResourceHooks<T, TInput>
>;

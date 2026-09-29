import type { QueryClient } from '@tanstack/vue-query'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { ApiError, apiClient, unwrap } from '../api/client.ts'

const ensureOk = (res: { ok: boolean; status: number }) => {
  if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)
}

export const companiesQueryOptions = queryOptions({
  queryKey: ['companies'],
  queryFn: async () => unwrap(await apiClient.companies.$get()),
  staleTime: 60_000,
})

/** `queryClient` is only needed in tests, to run the query outside of a mounted app. */
export const useCompaniesQuery = (queryClient?: QueryClient) =>
  useQuery(companiesQueryOptions, queryClient)

/** Departments of one company; idle while `companyId` is empty. */
export const useDepartmentsQuery = (
  companyId: MaybeRefOrGetter<string | null | undefined>,
  queryClient?: QueryClient,
) =>
  useQuery(
    {
      queryKey: ['departments', companyId],
      queryFn: async () =>
        unwrap(
          await apiClient.companies[':companyId'].departments.$get({
            param: { companyId: toValue(companyId) ?? '' },
          }),
        ),
      enabled: computed(() => !!toValue(companyId)),
      staleTime: 60_000,
    },
    queryClient,
  )

/**
 * Master edits ripple into every card and the user's own affiliations (a merge re-points them),
 * so each one refreshes all cached server data rather than guessing which queries it touched.
 */
const useMasterMutation = <Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>,
  queryClient?: QueryClient,
  // Delete handles its own errors: a 409 there means "merge instead", not a generic failure.
  silent = false,
) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn,
      onSuccess: () => client.invalidateQueries(),
      meta: { silent },
    },
    client,
  )
}

export const useCompanyMutations = (queryClient?: QueryClient) => ({
  create: useMasterMutation(
    async (name: string) => unwrap(await apiClient.companies.$post({ json: { name } })),
    queryClient,
  ),
  rename: useMasterMutation(
    async ({ id, name }: { id: string; name: string }) =>
      unwrap(await apiClient.companies[':id'].$patch({ param: { id }, json: { name } })),
    queryClient,
  ),
  remove: useMasterMutation(
    async (id: string) => ensureOk(await apiClient.companies[':id'].$delete({ param: { id } })),
    queryClient,
    true,
  ),
  merge: useMasterMutation(
    async ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      unwrap(
        await apiClient.companies[':id'].merge.$post({
          param: { id: targetId },
          json: { sourceIds },
        }),
      ),
    queryClient,
  ),
})

export const useDepartmentMutations = (queryClient?: QueryClient) => ({
  create: useMasterMutation(
    async ({ companyId, name }: { companyId: string; name: string }) =>
      unwrap(
        await apiClient.companies[':companyId'].departments.$post({
          param: { companyId },
          json: { name },
        }),
      ),
    queryClient,
  ),
  rename: useMasterMutation(
    async ({ id, name }: { id: string; name: string }) =>
      unwrap(await apiClient.departments[':id'].$patch({ param: { id }, json: { name } })),
    queryClient,
  ),
  remove: useMasterMutation(
    async (id: string) => ensureOk(await apiClient.departments[':id'].$delete({ param: { id } })),
    queryClient,
    true,
  ),
  merge: useMasterMutation(
    async ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) =>
      unwrap(
        await apiClient.departments[':id'].merge.$post({
          param: { id: targetId },
          json: { sourceIds },
        }),
      ),
    queryClient,
  ),
})

/** Related projects and groups (one list; split by `kind` where shown). */
export const useTopicsQuery = (queryClient?: QueryClient) =>
  useQuery(
    {
      queryKey: ['topics'],
      queryFn: async () => unwrap(await apiClient.topics.$get({ query: {} })),
      staleTime: 60_000,
    },
    queryClient,
  )

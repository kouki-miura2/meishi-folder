import type { QueryClient } from '@tanstack/vue-query'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

import { ApiError, apiClient, unwrap } from '../api/client.ts'
import type { SaveMeInput } from '../api/types.ts'

/** The signed-in user's profile, or `null` until the welcome screen has saved one (the API's 404). */
export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: async () => {
    const res = await apiClient.me.$get()
    if ((res.status as number) === 404) return null
    return unwrap(res)
  },
  staleTime: 5 * 60_000,
})

/** `queryClient` is only needed in tests, to run the query outside of a mounted app. */
export const useMeQuery = (queryClient?: QueryClient) => useQuery(meQueryOptions, queryClient)

export const useSaveMeMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (input: SaveMeInput) => unwrap(await apiClient.me.$put({ json: input })),
      onSuccess: (me) => {
        client.setQueryData(meQueryOptions.queryKey, me)
        // Saving find-or-creates the affiliated companies and departments.
        void client.invalidateQueries({ queryKey: ['companies'] })
        void client.invalidateQueries({ queryKey: ['departments'] })
      },
    },
    client,
  )
}

/** Withdrawal: deletes all of the user's data. The caller signs out afterwards. */
export const useDeleteMeMutation = (queryClient?: QueryClient) =>
  useMutation(
    {
      mutationFn: async () => {
        const res = await apiClient.me.$delete()
        if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)
      },
    },
    queryClient ?? useQueryClient(),
  )

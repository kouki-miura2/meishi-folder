import type { QueryClient } from '@tanstack/vue-query'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

import { ApiError, apiClient, longRequest, unwrap } from '../api/client.ts'
import type { CardInput, CardUpdateInput } from '../api/types.ts'
import { type CardFilter, filterToQuery } from '../domain/card-filter.ts'

/** The card list, refetched as the filter changes; the previous results stay up while it loads. */
export const useCardsQuery = (filter: MaybeRefOrGetter<CardFilter>, queryClient?: QueryClient) =>
  useQuery(
    {
      // Keyed by the API query only: changing the order re-sorts on screen without a refetch.
      queryKey: ['cards', computed(() => filterToQuery(toValue(filter)))],
      queryFn: async () =>
        unwrap(await apiClient.cards.$get({ query: filterToQuery(toValue(filter)) })),
      placeholderData: keepPreviousData,
    },
    queryClient,
  )

export const useCardQuery = (id: MaybeRefOrGetter<string>, queryClient?: QueryClient) =>
  useQuery(
    {
      queryKey: ['card', id],
      queryFn: async () =>
        unwrap(await apiClient.cards[':id'].$get({ param: { id: toValue(id) } })),
    },
    queryClient,
  )

/** Registered cards with the same name: the possible same person before saving a new card. */
export const fetchCandidates = (client: QueryClient, name: string) =>
  client.fetchQuery({
    queryKey: ['candidates', name],
    queryFn: async () => unwrap(await apiClient.cards.candidates.$get({ query: { name } })),
    staleTime: 0,
  })

// Any card change can alter the list, the detail, the candidates and the masters' counts.
const useCardMutation = <Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>,
  queryClient?: QueryClient,
) => {
  const client = queryClient ?? useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries() }, client)
}

export const useCreateCardMutation = (queryClient?: QueryClient) =>
  useCardMutation(
    async (input: CardInput) => unwrap(await apiClient.cards.$post({ json: input })),
    queryClient,
  )

export const useUpdateCardMutation = (queryClient?: QueryClient) =>
  useCardMutation(
    async ({ id, input }: { id: string; input: CardUpdateInput }) =>
      unwrap(await apiClient.cards[':id'].$patch({ param: { id }, json: input })),
    queryClient,
  )

export const useDeleteCardMutation = (queryClient?: QueryClient) =>
  useCardMutation(async (id: string) => {
    const res = await apiClient.cards[':id'].$delete({ param: { id } })
    if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)
  }, queryClient)

/** Every card as a CSV file (`GET /cards/export`), for the settings screen's download. */
export const useExportCardsMutation = (queryClient?: QueryClient) =>
  useMutation(
    {
      mutationFn: async () => {
        const res = await apiClient.cards.export.$get(undefined, longRequest())
        if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)
        return res.blob()
      },
    },
    queryClient ?? useQueryClient(),
  )

/** Uploads a photo. The photo goes into the image cache too, so showing it needs no download. */
export const useUploadImageMutation = (queryClient?: QueryClient) => {
  const client = queryClient ?? useQueryClient()
  return useMutation(
    {
      mutationFn: async (file: File) =>
        unwrap(await apiClient.images.$post({ form: { file } }, longRequest())),
      onSuccess: ({ id }, file) => client.setQueryData(['image', id], file),
    },
    client,
  )
}

export const useExtractCardMutation = (queryClient?: QueryClient) =>
  useMutation(
    {
      mutationFn: async (images: { frontImageId: string; backImageId?: string | null }) =>
        unwrap(await apiClient.cards.extract.$post({ json: images }, longRequest())),
    },
    queryClient,
  )

const downloadImage = async (id: string) => {
  const res = await apiClient.images[':id'].$get({ param: { id } })
  if (!res.ok) throw new ApiError(res.status, `Request failed: ${res.status}`)
  return res.blob()
}

/** A card photo's content, from the cache when it is already shown. An image id never gets different content. */
export const fetchCardImage = (client: QueryClient, id: string) =>
  client.fetchQuery({
    queryKey: ['image', id],
    queryFn: () => downloadImage(id),
    staleTime: Infinity,
  })

/**
 * A card photo as an object URL for `<img src>`: the API needs the Authorization header, which an
 * `<img>` can't send. The URL is revoked when the image changes or the component goes away.
 */
export const useCardImageUrl = (
  id: MaybeRefOrGetter<string | null | undefined>,
  queryClient?: QueryClient,
) => {
  const query = useQuery(
    {
      queryKey: ['image', id],
      queryFn: () => downloadImage(toValue(id) ?? ''),
      enabled: computed(() => !!toValue(id)),
      // An image id never gets different content.
      staleTime: Infinity,
    },
    queryClient,
  )
  const url = ref<string | null>(null)
  watch(
    query.data,
    (blob) => {
      if (url.value) URL.revokeObjectURL(url.value)
      url.value = blob ? URL.createObjectURL(blob) : null
    },
    { immediate: true },
  )
  onScopeDispose(() => {
    if (url.value) URL.revokeObjectURL(url.value)
  })
  return { url, isLoading: query.isLoading }
}

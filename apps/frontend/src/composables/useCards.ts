import type { QueryClient } from '@tanstack/vue-query'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

import { ApiError, apiClient, longRequest, unwrap } from '../api/client.ts'
import { CardLimitError } from '../api/errors.ts'
import type { CardInput, CardUpdateInput, CardView } from '../api/types.ts'
import { type CardFilter, filterCards } from '../domain/card-filter.ts'

/** Every card of the user, in full: one cache entry that every search and filter reads from. */
const cardsQueryOptions = queryOptions({
  queryKey: ['cards'],
  queryFn: async () => unwrap(await apiClient.cards.$get()),
})

/**
 * The card list narrowed by the filter. The cards are fetched once and filtered on screen, so a
 * search or a topic choice changes `data` at once without calling the API.
 */
export const useCardsQuery = (filter: MaybeRefOrGetter<CardFilter>, queryClient?: QueryClient) => {
  const query = useQuery(cardsQueryOptions, queryClient)
  const data = computed(() => query.data.value && filterCards(query.data.value, toValue(filter)))
  return { ...query, data }
}

/** How many cards the user has, from the card list's cache. */
export const fetchCardCount = async (client: QueryClient) =>
  (await client.fetchQuery(cardsQueryOptions)).length

/** One card, read out of the card list's cache: opening a card calls no API. `null` if it's gone. */
export const useCardQuery = (id: MaybeRefOrGetter<string>, queryClient?: QueryClient) =>
  useQuery(
    computed(() => {
      // Read here, not inside `select`, so a new id makes new options and the selection reruns.
      const cardId = toValue(id)
      return {
        ...cardsQueryOptions,
        select: (cards: CardView[]) => cards.find((card) => card.id === cardId) ?? null,
      }
    }),
    queryClient,
  )

/** Registered cards with the same name: the possible same person before saving a new card. */
export const fetchCandidates = (client: QueryClient, name: string) =>
  client.fetchQuery({
    queryKey: ['candidates', name],
    queryFn: async () => unwrap(await apiClient.cards.candidates.$get({ query: { name } })),
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
  useCardMutation(async (input: CardInput) => {
    const res = await apiClient.cards.$post({ json: input })
    if ((res.status as number) === 409) throw new CardLimitError()
    return unwrap(res)
  }, queryClient)

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

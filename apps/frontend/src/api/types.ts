import type { InferRequestType, InferResponseType } from 'hono/client'

import type { apiClient } from './client.ts'

// Aliases over the types Hono RPC infers from the backend's routes. Nothing here is hand-written:
// if a backend response changes, these follow.

export type Me = InferResponseType<typeof apiClient.me.$get, 200>
export type SaveMeInput = InferRequestType<typeof apiClient.me.$put>['json']
export type CompanyListItem = InferResponseType<typeof apiClient.companies.$get, 200>[number]
export type DepartmentListItem = InferResponseType<
  (typeof apiClient.companies)[':companyId']['departments']['$get'],
  200
>[number]
export type Topic = InferResponseType<typeof apiClient.topics.$get, 200>[number]
export type CardSummary = InferResponseType<typeof apiClient.cards.candidates.$get, 200>[number]
export type CardView = InferResponseType<typeof apiClient.cards.$get, 200>[number]
export type CardInput = InferRequestType<typeof apiClient.cards.$post>['json']
export type CardUpdateInput = InferRequestType<(typeof apiClient.cards)[':id']['$patch']>['json']
export type ExtractedCard = InferResponseType<typeof apiClient.cards.extract.$post, 200>
export type Office = CardView['offices'][number]
export type MasterRef = CardView['departments'][number]

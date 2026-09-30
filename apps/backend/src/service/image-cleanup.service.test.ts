import { expect, test } from 'vite-plus/test'

import type { Card } from '../repository/card.repository.ts'
import { fakeCardImageRepository, fakeCardRepository } from './fakes.ts'
import { ORPHAN_IMAGE_AGE_MS, createImageCleanupService } from './image-cleanup.service.ts'

const now = new Date('2026-09-30T00:00:00.000Z')
const old = new Date(now.getTime() - ORPHAN_IMAGE_AGE_MS - 1)
const young = new Date(now.getTime() - ORPHAN_IMAGE_AGE_MS + 1)
const image = { body: new ArrayBuffer(1), contentType: 'image/jpeg' }

test('deleteOrphans deletes old photos no card uses, and keeps used or young ones', async () => {
  const cardImageRepository = fakeCardImageRepository(
    new Map(['front', 'back', 'orphan', 'young'].map((id) => [id, image])),
  )
  for (const id of ['front', 'back', 'orphan']) cardImageRepository.uploadedAt.set(id, old)
  cardImageRepository.uploadedAt.set('young', young)
  const cardRepository = fakeCardRepository([
    { id: 'card-1', frontImageId: 'front', backImageId: 'back' } as Card,
  ])
  const service = createImageCleanupService({ cardRepository, cardImageRepository })

  await expect(service.deleteOrphans(now)).resolves.toBe(1)
  expect([...cardImageRepository.images.keys()]).toEqual(['front', 'back', 'young'])
})

test('deleteOrphans does nothing when every photo is in use', async () => {
  const cardImageRepository = fakeCardImageRepository(new Map([['front', image]]))
  cardImageRepository.uploadedAt.set('front', old)
  const cardRepository = fakeCardRepository([
    { id: 'card-1', frontImageId: 'front', backImageId: null } as Card,
  ])
  const service = createImageCleanupService({ cardRepository, cardImageRepository })

  await expect(service.deleteOrphans(now)).resolves.toBe(0)
  expect(cardImageRepository.images.has('front')).toBe(true)
})

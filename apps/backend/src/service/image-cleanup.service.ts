import { LIMITS } from 'utils'

import type { CardImageRepository } from '../repository/card-image.repository.ts'
import type { CardRepository } from '../repository/card.repository.ts'

/**
 * How long an uploaded photo may go unused before it counts as left over. Photos are uploaded
 * before the card is saved (and again when turned), so a young unused photo may still be on its way
 * into a card.
 */
export const ORPHAN_IMAGE_AGE_MS = LIMITS.orphanImageKeepHours * 60 * 60 * 1000

export interface ImageCleanupService {
  /** Deletes the photos no card uses that are older than `ORPHAN_IMAGE_AGE_MS`; returns how many. */
  deleteOrphans: (now?: Date) => Promise<number>
}

export const createImageCleanupService = ({
  cardRepository,
  cardImageRepository,
}: {
  cardRepository: CardRepository
  cardImageRepository: CardImageRepository
}): ImageCleanupService => ({
  deleteOrphans: async (now = new Date()) => {
    const cutoff = now.getTime() - ORPHAN_IMAGE_AGE_MS
    const oldIds = new Map<string, string[]>()
    for (const image of await cardImageRepository.list()) {
      if (image.uploadedAt.getTime() >= cutoff) continue
      oldIds.set(image.userId, [...(oldIds.get(image.userId) ?? []), image.id])
    }
    let deleted = 0
    for (const [userId, ids] of oldIds) {
      const used = new Set(
        (await cardRepository.list(userId, {})).flatMap((card) => [
          card.frontImageId,
          card.backImageId,
        ]),
      )
      const orphans = ids.filter((id) => !used.has(id))
      if (orphans.length > 0) await cardImageRepository.delete(userId, orphans)
      deleted += orphans.length
    }
    return deleted
  },
})

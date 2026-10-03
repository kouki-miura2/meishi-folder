import type { DataVersionRepository } from '../repository/data-version.repository.ts'

/**
 * One version per user, changed by every write to their data, so a client can tell whether its
 * cached responses are still current with a single-row read. Only compared for equality: a random
 * id rather than a timestamp, so two writes in the same millisecond never share one.
 */
export interface DataVersionService {
  get: (userId: string) => Promise<string | null>
  /** Gives the user's data a new version and returns it. */
  bump: (userId: string) => Promise<string>
}

export const createDataVersionService = (
  repository: DataVersionRepository,
): DataVersionService => ({
  get: (userId) => repository.get(userId),
  bump: async (userId) => {
    const version = crypto.randomUUID()
    await repository.save(userId, version)
    return version
  },
})

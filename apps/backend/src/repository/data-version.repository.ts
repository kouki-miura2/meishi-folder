import type { DataVersionDao } from '../dao/data-version.interface.ts'

export interface DataVersionRepository {
  get: (userId: string) => Promise<string | null>
  save: (userId: string, version: string) => Promise<void>
}

export const createDataVersionRepository = (dao: DataVersionDao): DataVersionRepository => ({
  get: (userId) => dao.get(userId),
  save: (userId, version) => dao.save(userId, version),
})

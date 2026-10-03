import type { DataVersionDao } from 'backend/src/dao/data-version.interface.ts'

export const createDataVersionDao = (db: D1Database): DataVersionDao => ({
  get: async (userId) =>
    (
      await db
        .prepare('SELECT version FROM data_versions WHERE user_id = ?')
        .bind(userId)
        .first<{ version: string }>()
    )?.version ?? null,
  save: async (userId, version) => {
    await db
      .prepare(
        `INSERT INTO data_versions (user_id, version) VALUES (?, ?)
         ON CONFLICT (user_id) DO UPDATE SET version = excluded.version`,
      )
      .bind(userId, version)
      .run()
  },
})

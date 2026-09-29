import type { TopicDao, TopicRecord } from 'backend/src/dao/topic.interface.ts'

export const createTopicDao = (db: D1Database): TopicDao => ({
  listByUser: async (userId) =>
    (
      await db
        .prepare('SELECT * FROM topics WHERE user_id = ? ORDER BY name')
        .bind(userId)
        .all<TopicRecord>()
    ).results,
  findByName: (userId, kind, name) =>
    db
      .prepare('SELECT * FROM topics WHERE user_id = ? AND kind = ? AND name = ?')
      .bind(userId, kind, name)
      .first<TopicRecord>(),
  insert: async (record) => {
    await db
      .prepare('INSERT INTO topics (id, user_id, kind, name) VALUES (?, ?, ?, ?)')
      .bind(record.id, record.user_id, record.kind, record.name)
      .run()
  },
})

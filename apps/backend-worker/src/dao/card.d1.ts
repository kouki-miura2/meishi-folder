import type { CardDao, CardRecord } from 'backend/src/dao/card.interface.ts'

type CardRow = Omit<CardRecord, 'department_ids' | 'topic_ids'>

const COLUMNS = [
  'id',
  'user_id',
  'name',
  'name_kana',
  'name_romaji',
  'company_id',
  'titles',
  'job_types',
  'mobile',
  'emails',
  'other_contacts',
  'url',
  'offices',
  'met_on',
  'met_at',
  'met_occasion',
  'handle_name',
  'memo',
  'front_image_id',
  'back_image_id',
  'visibility',
  'created_at',
  'updated_at',
] as const satisfies (keyof CardRow)[]

const withoutSpaces = (value: string) => value.replace(/[ 　]/g, '')

export const createCardDao = (db: D1Database): CardDao => {
  /** Adds the join-table ids to each row (rowid order keeps the order they were saved in). */
  const withIds = async (userId: string, rows: CardRow[]): Promise<CardRecord[]> => {
    if (rows.length === 0) return []
    const ids = JSON.stringify(rows.map((row) => row.id))
    const [departments, topics] = await db.batch<{ card_id: string; id: string }>([
      db
        .prepare(
          `SELECT cd.card_id, cd.department_id AS id FROM card_departments cd
           JOIN cards c ON c.id = cd.card_id
           WHERE c.user_id = ? AND cd.card_id IN (SELECT value FROM json_each(?)) ORDER BY cd.rowid`,
        )
        .bind(userId, ids),
      db
        .prepare(
          `SELECT ct.card_id, ct.topic_id AS id FROM card_topics ct
           JOIN cards c ON c.id = ct.card_id
           WHERE c.user_id = ? AND ct.card_id IN (SELECT value FROM json_each(?)) ORDER BY ct.rowid`,
        )
        .bind(userId, ids),
    ])
    const idsOf = (links: { card_id: string; id: string }[] | undefined, cardId: string) =>
      (links ?? []).filter((link) => link.card_id === cardId).map((link) => link.id)
    return rows.map((row) => ({
      ...row,
      department_ids: idsOf(departments?.results, row.id),
      topic_ids: idsOf(topics?.results, row.id),
    }))
  }

  const linkStatements = (record: CardRecord) => [
    db.prepare('DELETE FROM card_departments WHERE card_id = ?').bind(record.id),
    ...record.department_ids.map((id) =>
      db
        .prepare('INSERT INTO card_departments (card_id, department_id) VALUES (?, ?)')
        .bind(record.id, id),
    ),
    db.prepare('DELETE FROM card_topics WHERE card_id = ?').bind(record.id),
    ...record.topic_ids.map((id) =>
      db.prepare('INSERT INTO card_topics (card_id, topic_id) VALUES (?, ?)').bind(record.id, id),
    ),
  ]

  return {
    list: async (userId) => {
      const { results } = await db
        .prepare(
          `SELECT * FROM cards WHERE user_id = ?
           ORDER BY COALESCE(name_kana, handle_name, name, ''), created_at`,
        )
        .bind(userId)
        .all<CardRow>()
      return withIds(userId, results)
    },
    findById: async (userId, id) => {
      const row = await db
        .prepare('SELECT * FROM cards WHERE user_id = ? AND id = ?')
        .bind(userId, id)
        .first<CardRow>()
      return row ? ((await withIds(userId, [row]))[0] ?? null) : null
    },
    findByName: async (userId, name) => {
      const { results } = await db
        .prepare(
          `SELECT * FROM cards
           WHERE user_id = ? AND REPLACE(REPLACE(name, ' ', ''), '　', '') = ?
           ORDER BY created_at`,
        )
        .bind(userId, withoutSpaces(name))
        .all<CardRow>()
      return withIds(userId, results)
    },
    count: async (userId) => {
      const row = await db
        .prepare('SELECT COUNT(*) AS n FROM cards WHERE user_id = ?')
        .bind(userId)
        .first<{ n: number }>()
      return row?.n ?? 0
    },
    insert: async (record) => {
      await db.batch([
        db
          .prepare(
            `INSERT INTO cards (${COLUMNS.join(', ')}) VALUES (${COLUMNS.map(() => '?').join(', ')})`,
          )
          .bind(...COLUMNS.map((column) => record[column])),
        ...linkStatements(record),
      ])
    },
    update: async (record) => {
      const updated = COLUMNS.filter((column) => column !== 'id' && column !== 'user_id')
      await db.batch([
        db
          .prepare(
            `UPDATE cards SET ${updated.map((column) => `${column} = ?`).join(', ')}
             WHERE id = ? AND user_id = ?`,
          )
          .bind(...updated.map((column) => record[column]), record.id, record.user_id),
        ...linkStatements(record),
      ])
    },
    delete: async (userId, id) => {
      const owned = 'SELECT id FROM cards WHERE user_id = ? AND id = ?'
      await db.batch([
        db.prepare(`DELETE FROM card_departments WHERE card_id IN (${owned})`).bind(userId, id),
        db.prepare(`DELETE FROM card_topics WHERE card_id IN (${owned})`).bind(userId, id),
        db.prepare('DELETE FROM cards WHERE user_id = ? AND id = ?').bind(userId, id),
      ])
    },
  }
}

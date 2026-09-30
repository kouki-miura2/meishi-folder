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

// Every free-text column; the list columns are searched as their JSON text.
const SEARCHED = [
  'name',
  'name_kana',
  'name_romaji',
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
] as const satisfies (keyof CardRow)[]

const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
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
    list: async (userId, { q, topicIds = [], match = 'all' }) => {
      const textMatch = SEARCHED.map((column) => `c.${column} LIKE ?2 ESCAPE '\\'`).join(' OR ')
      const { results } = await db
        .prepare(
          `SELECT c.* FROM cards c
           WHERE c.user_id = ?1
             AND (?2 IS NULL OR ${textMatch}
               OR EXISTS (SELECT 1 FROM companies co
                          WHERE co.id = c.company_id AND co.name LIKE ?2 ESCAPE '\\')
               OR EXISTS (SELECT 1 FROM card_departments cd JOIN departments d ON d.id = cd.department_id
                          WHERE cd.card_id = c.id AND d.name LIKE ?2 ESCAPE '\\')
               OR EXISTS (SELECT 1 FROM card_topics ct JOIN topics t ON t.id = ct.topic_id
                          WHERE ct.card_id = c.id AND t.name LIKE ?2 ESCAPE '\\'))
             AND (json_array_length(?3) = 0 OR
                  (SELECT COUNT(*) FROM card_topics ct
                   WHERE ct.card_id = c.id AND ct.topic_id IN (SELECT value FROM json_each(?3)))
                  >= CASE ?4 WHEN 'any' THEN 1 ELSE json_array_length(?3) END)
           ORDER BY COALESCE(c.name_kana, c.handle_name, c.name, ''), c.created_at`,
        )
        .bind(userId, q ? likePattern(q) : null, JSON.stringify([...new Set(topicIds)]), match)
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

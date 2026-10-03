import type { UserAffiliationRecord, UserDao, UserRecord } from 'backend/src/dao/user.interface.ts'

export const createUserDao = (db: D1Database): UserDao => ({
  findById: async (id) => {
    const user = await db
      .prepare(`SELECT id, name, name_kana, terms_version, terms_agreed_at, created_at, updated_at
           FROM users WHERE id = ?`)
      .bind(id)
      .first<Omit<UserRecord, 'affiliations'>>()
    if (!user) return null
    const { results } = await db
      .prepare(
        'SELECT company_id, department_id FROM user_affiliations WHERE user_id = ? ORDER BY rowid',
      )
      .bind(id)
      .all<UserAffiliationRecord>()
    return { ...user, affiliations: results }
  },
  save: async (record) => {
    await db.batch([
      db
        .prepare(
          `INSERT INTO users (id, name, name_kana, terms_version, terms_agreed_at, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT (id) DO UPDATE SET
             name = ?2, name_kana = ?3, terms_version = ?4, terms_agreed_at = ?5, updated_at = ?7`,
        )
        .bind(
          record.id,
          record.name,
          record.name_kana,
          record.terms_version,
          record.terms_agreed_at,
          record.created_at,
          record.updated_at,
        ),
      db.prepare('DELETE FROM user_affiliations WHERE user_id = ?').bind(record.id),
      ...record.affiliations.map((a) =>
        db
          .prepare(
            'INSERT INTO user_affiliations (user_id, company_id, department_id) VALUES (?, ?, ?)',
          )
          .bind(record.id, a.company_id, a.department_id),
      ),
    ])
  },
  // Children before parents: the foreign keys are enforced.
  deleteAll: async (id) => {
    await db.batch(
      [
        'DELETE FROM card_departments WHERE card_id IN (SELECT id FROM cards WHERE user_id = ?)',
        'DELETE FROM card_topics WHERE card_id IN (SELECT id FROM cards WHERE user_id = ?)',
        'DELETE FROM cards WHERE user_id = ?',
        'DELETE FROM user_affiliations WHERE user_id = ?',
        'DELETE FROM users WHERE id = ?',
        'DELETE FROM topics WHERE user_id = ?',
        'DELETE FROM departments WHERE user_id = ?',
        'DELETE FROM companies WHERE user_id = ?',
        'DELETE FROM data_versions WHERE user_id = ?',
      ].map((sql) => db.prepare(sql).bind(id)),
    )
  },
})

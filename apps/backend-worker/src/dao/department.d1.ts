import type { DepartmentDao, DepartmentRecord } from 'backend/src/dao/department.interface.ts'

/** Removes affiliations that became identical after a merge re-pointed them. */
export const dedupeAffiliations = (db: D1Database, userId: string) =>
  db
    .prepare(
      `DELETE FROM user_affiliations WHERE user_id = ?1 AND rowid NOT IN (
         SELECT MIN(rowid) FROM user_affiliations WHERE user_id = ?1 GROUP BY company_id, department_id
       )`,
    )
    .bind(userId)

export const createDepartmentDao = (db: D1Database): DepartmentDao => ({
  listByUser: async (userId) =>
    (
      await db
        .prepare('SELECT * FROM departments WHERE user_id = ? ORDER BY name')
        .bind(userId)
        .all<DepartmentRecord>()
    ).results,
  listByCompany: async (userId, companyId) =>
    (
      await db
        .prepare('SELECT * FROM departments WHERE user_id = ? AND company_id = ? ORDER BY name')
        .bind(userId, companyId)
        .all<DepartmentRecord>()
    ).results,
  findById: (userId, id) =>
    db
      .prepare('SELECT * FROM departments WHERE user_id = ? AND id = ?')
      .bind(userId, id)
      .first<DepartmentRecord>(),
  findByName: (userId, companyId, name) =>
    db
      .prepare('SELECT * FROM departments WHERE user_id = ? AND company_id = ? AND name = ?')
      .bind(userId, companyId, name)
      .first<DepartmentRecord>(),
  insert: async (record) => {
    await db
      .prepare('INSERT INTO departments (id, user_id, company_id, name) VALUES (?, ?, ?, ?)')
      .bind(record.id, record.user_id, record.company_id, record.name)
      .run()
  },
  rename: async (userId, id, name) => {
    await db
      .prepare('UPDATE departments SET name = ? WHERE user_id = ? AND id = ?')
      .bind(name, userId, id)
      .run()
  },
  delete: async (userId, id) => {
    await db.prepare('DELETE FROM departments WHERE user_id = ? AND id = ?').bind(userId, id).run()
  },
  isReferenced: async (userId, id) => {
    const row = await db
      .prepare(
        `SELECT EXISTS (
           SELECT 1 FROM card_departments cd JOIN cards c ON c.id = cd.card_id
           WHERE c.user_id = ?1 AND cd.department_id = ?2
         ) OR EXISTS (
           SELECT 1 FROM user_affiliations WHERE user_id = ?1 AND department_id = ?2
         ) AS referenced`,
      )
      .bind(userId, id)
      .first<{ referenced: number }>()
    return row?.referenced === 1
  },
  merge: async (userId, targetId, sourceIds) => {
    const sources = JSON.stringify(sourceIds)
    const inSources = '(SELECT value FROM json_each(?2))'
    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO card_departments (card_id, department_id)
           SELECT card_id, ?1 FROM card_departments WHERE department_id IN ${inSources}`,
        )
        .bind(targetId, sources),
      db
        .prepare(`DELETE FROM card_departments WHERE department_id IN ${inSources}`)
        .bind(targetId, sources),
      db
        .prepare(
          `UPDATE user_affiliations SET department_id = ?1
           WHERE user_id = ?3 AND department_id IN ${inSources}`,
        )
        .bind(targetId, sources, userId),
      dedupeAffiliations(db, userId),
      db
        .prepare(`DELETE FROM departments WHERE user_id = ?3 AND id IN ${inSources}`)
        .bind(targetId, sources, userId),
    ])
  },
})

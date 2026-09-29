import type { CompanyDao, CompanyRecord } from 'backend/src/dao/company.interface.ts'

import { dedupeAffiliations } from './department.d1.ts'

// Departments of source company ?3 whose name already exists under target company ?2 (user ?1).
const SAME_NAME_DEPARTMENTS = `
  SELECT d.id AS source_id, t.id AS target_id
  FROM departments d JOIN departments t ON t.company_id = ?2 AND t.name = d.name
  WHERE d.user_id = ?1 AND d.company_id = ?3`

export const createCompanyDao = (db: D1Database): CompanyDao => ({
  listByUser: async (userId) =>
    (
      await db
        .prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY name')
        .bind(userId)
        .all<CompanyRecord>()
    ).results,
  findById: (userId, id) =>
    db
      .prepare('SELECT * FROM companies WHERE user_id = ? AND id = ?')
      .bind(userId, id)
      .first<CompanyRecord>(),
  findByName: (userId, name) =>
    db
      .prepare('SELECT * FROM companies WHERE user_id = ? AND name = ?')
      .bind(userId, name)
      .first<CompanyRecord>(),
  insert: async (record) => {
    await db
      .prepare('INSERT INTO companies (id, user_id, name) VALUES (?, ?, ?)')
      .bind(record.id, record.user_id, record.name)
      .run()
  },
  rename: async (userId, id, name) => {
    await db
      .prepare('UPDATE companies SET name = ? WHERE user_id = ? AND id = ?')
      .bind(name, userId, id)
      .run()
  },
  delete: async (userId, id) => {
    await db.batch([
      db.prepare('DELETE FROM departments WHERE user_id = ? AND company_id = ?').bind(userId, id),
      db.prepare('DELETE FROM companies WHERE user_id = ? AND id = ?').bind(userId, id),
    ])
  },
  isReferenced: async (userId, id) => {
    const row = await db
      .prepare(
        `SELECT EXISTS (SELECT 1 FROM cards WHERE user_id = ?1 AND company_id = ?2)
             OR EXISTS (SELECT 1 FROM user_affiliations WHERE user_id = ?1 AND company_id = ?2)
             AS referenced`,
      )
      .bind(userId, id)
      .first<{ referenced: number }>()
    return row?.referenced === 1
  },
  merge: async (userId, targetId, sourceIds) => {
    // One source at a time: two sources may both hold a department of the same name, and the
    // second must fold into the one the first just moved under the target.
    const perSource = sourceIds.flatMap((sourceId) =>
      [
        `INSERT OR IGNORE INTO card_departments (card_id, department_id)
         SELECT cd.card_id, m.target_id FROM card_departments cd
         JOIN (${SAME_NAME_DEPARTMENTS}) m ON m.source_id = cd.department_id`,
        `DELETE FROM card_departments
         WHERE department_id IN (SELECT source_id FROM (${SAME_NAME_DEPARTMENTS}))`,
        `UPDATE user_affiliations
         SET department_id = (
           SELECT target_id FROM (${SAME_NAME_DEPARTMENTS}) m
           WHERE m.source_id = user_affiliations.department_id
         )
         WHERE user_id = ?1
           AND department_id IN (SELECT source_id FROM (${SAME_NAME_DEPARTMENTS}))`,
        `DELETE FROM departments WHERE id IN (SELECT source_id FROM (${SAME_NAME_DEPARTMENTS}))`,
        'UPDATE departments SET company_id = ?2 WHERE user_id = ?1 AND company_id = ?3',
        'UPDATE cards SET company_id = ?2 WHERE user_id = ?1 AND company_id = ?3',
        'UPDATE user_affiliations SET company_id = ?2 WHERE user_id = ?1 AND company_id = ?3',
      ].map((sql) => db.prepare(sql).bind(userId, targetId, sourceId)),
    )
    await db.batch([
      ...perSource,
      dedupeAffiliations(db, userId),
      db
        .prepare(
          'DELETE FROM companies WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))',
        )
        .bind(userId, JSON.stringify(sourceIds)),
    ])
  },
})

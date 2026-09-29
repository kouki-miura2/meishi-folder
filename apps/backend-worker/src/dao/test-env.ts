/// <reference types="vite/client" />
import { getPlatformProxy, unstable_splitSqlQuery } from 'wrangler'

const migrations = import.meta.glob<string>('../../migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Children before parents, so deleting never trips a foreign key.
const TABLES = [
  'card_topics',
  'card_departments',
  'cards',
  'topics',
  'user_affiliations',
  'users',
  'departments',
  'companies',
]

/**
 * Test-only: local D1 and R2 bindings (in memory, nothing persisted, no remote calls) with every
 * migration applied, so the datastore-backed DAOs run against the real engines.
 */
export const createTestEnv = async () => {
  const proxy = await getPlatformProxy<Env>({ persist: false, remoteBindings: false })
  const { DB } = proxy.env
  for (const path of Object.keys(migrations).sort()) {
    const sql = migrations[path] ?? ''
    await DB.batch(unstable_splitSqlQuery(sql).map((statement) => DB.prepare(statement)))
  }
  return {
    env: proxy.env,
    dispose: proxy.dispose,
    reset: async () => {
      await DB.batch(TABLES.map((table) => DB.prepare(`DELETE FROM ${table}`)))
    },
  }
}

import type { DepartmentDao } from './department.interface.ts'
import { byName, type MemoryStore } from './memory-store.ts'

/** Shared with the company DAO, whose merge folds same-named departments together. */
export const mergeDepartments = (
  store: MemoryStore,
  userId: string,
  targetId: string,
  sourceIds: string[],
) => {
  const isSource = (id: string | null) => id !== null && sourceIds.includes(id)

  for (const card of store.cards.filter((c) => c.user_id === userId)) {
    card.department_ids = [
      ...new Set(card.department_ids.map((id) => (isSource(id) ? targetId : id))),
    ]
  }
  for (const user of store.users.filter((u) => u.id === userId)) {
    for (const affiliation of user.affiliations) {
      if (isSource(affiliation.department_id)) affiliation.department_id = targetId
    }
  }
  store.departments = store.departments.filter((d) => !(d.user_id === userId && isSource(d.id)))
}

export const createDepartmentDao = (store: MemoryStore): DepartmentDao => {
  const find = (userId: string, id: string) =>
    store.departments.find((d) => d.user_id === userId && d.id === id)

  return {
    listByUser: async (userId) =>
      store.departments
        .filter((d) => d.user_id === userId)
        .sort(byName)
        .map((d) => ({ ...d })),
    listByCompany: async (userId, companyId) =>
      store.departments
        .filter((d) => d.user_id === userId && d.company_id === companyId)
        .sort(byName)
        .map((d) => ({
          ...d,
          card_count: store.cards.filter((card) => card.department_ids.includes(d.id)).length,
        })),
    findById: async (userId, id) => {
      const department = find(userId, id)
      return department ? { ...department } : null
    },
    findByName: async (userId, companyId, name) => {
      const department = store.departments.find(
        (d) => d.user_id === userId && d.company_id === companyId && d.name === name,
      )
      return department ? { ...department } : null
    },
    insert: async (record) => {
      store.departments.push({ ...record })
    },
    rename: async (userId, id, name) => {
      const department = find(userId, id)
      if (department) department.name = name
    },
    delete: async (userId, id) => {
      store.departments = store.departments.filter((d) => !(d.user_id === userId && d.id === id))
    },
    isReferenced: async (userId, id) =>
      store.cards.some((card) => card.user_id === userId && card.department_ids.includes(id)) ||
      store.users.some(
        (user) => user.id === userId && user.affiliations.some((a) => a.department_id === id),
      ),
    merge: async (userId, targetId, sourceIds) => {
      mergeDepartments(store, userId, targetId, sourceIds)
    },
  }
}

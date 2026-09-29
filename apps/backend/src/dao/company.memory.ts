import type { CompanyDao } from './company.interface.ts'
import { mergeDepartments } from './department.memory.ts'
import { byName, type MemoryStore } from './memory-store.ts'

export const createCompanyDao = (store: MemoryStore): CompanyDao => ({
  listByUser: async (userId) =>
    store.companies
      .filter((c) => c.user_id === userId)
      .sort(byName)
      .map((c) => ({ ...c })),
  findById: async (userId, id) => {
    const company = store.companies.find((c) => c.user_id === userId && c.id === id)
    return company ? { ...company } : null
  },
  findByName: async (userId, name) => {
    const company = store.companies.find((c) => c.user_id === userId && c.name === name)
    return company ? { ...company } : null
  },
  insert: async (record) => {
    store.companies.push({ ...record })
  },
  rename: async (userId, id, name) => {
    const company = store.companies.find((c) => c.user_id === userId && c.id === id)
    if (company) company.name = name
  },
  delete: async (userId, id) => {
    store.departments = store.departments.filter(
      (d) => !(d.user_id === userId && d.company_id === id),
    )
    store.companies = store.companies.filter((c) => !(c.user_id === userId && c.id === id))
  },
  isReferenced: async (userId, id) =>
    store.cards.some((card) => card.user_id === userId && card.company_id === id) ||
    store.users.some(
      (user) => user.id === userId && user.affiliations.some((a) => a.company_id === id),
    ),
  merge: async (userId, targetId, sourceIds) => {
    const isSource = (id: string | null) => id !== null && sourceIds.includes(id)

    for (const card of store.cards) {
      if (card.user_id === userId && isSource(card.company_id)) card.company_id = targetId
    }
    for (const user of store.users.filter((u) => u.id === userId)) {
      for (const affiliation of user.affiliations) {
        if (isSource(affiliation.company_id)) affiliation.company_id = targetId
      }
    }
    for (const department of store.departments.filter(
      (d) => d.user_id === userId && isSource(d.company_id),
    )) {
      const sameName = store.departments.find(
        (d) => d.company_id === targetId && d.name === department.name,
      )
      if (sameName) mergeDepartments(store, userId, sameName.id, [department.id])
      else department.company_id = targetId
    }
    // Folding departments together can leave two identical affiliations behind.
    for (const user of store.users.filter((u) => u.id === userId)) {
      user.affiliations = user.affiliations.filter(
        (a, index, all) =>
          all.findIndex(
            (b) => b.company_id === a.company_id && b.department_id === a.department_id,
          ) === index,
      )
    }
    store.companies = store.companies.filter((c) => !(c.user_id === userId && isSource(c.id)))
  },
})

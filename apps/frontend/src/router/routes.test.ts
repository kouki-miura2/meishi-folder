import { expect, test } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from './routes.ts'

const router = createRouter({ history: createMemoryHistory(), routes })

test.each([
  ['/login', 'login'],
  ['/welcome', 'welcome'],
  ['/', 'cards'],
  ['/cards/new', 'card-new'],
  ['/cards/c-1', 'card'],
  ['/cards/c-1/edit', 'card-edit'],
  ['/settings/companies', 'companies'],
  ['/settings/companies/co-1/departments', 'departments'],
])('resolves %s to the %s route', (path, name) => {
  expect(router.resolve(path).name).toBe(name)
})

test('passes route params to the views as props', () => {
  const resolved = router.resolve('/cards/c-1/edit')

  expect(resolved.params).toEqual({ id: 'c-1' })
  expect(resolved.matched[0]?.props.default).toBe(true)
})

test('only the login screen is public', () => {
  expect(routes.filter((r) => r.meta?.public).map((r) => r.name)).toEqual(['login'])
})

test('has no match for an unknown path', () => {
  expect(router.resolve('/does-not-exist').matched).toHaveLength(0)
})

import { expect, test, vi } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { backTo } from './back.ts'
import { routes } from './routes.ts'

// The previous entry vue-router recorded in `history.state.back`; null when there is none.
const routerWithBack = (back: string | null) => {
  const history = createMemoryHistory()
  vi.spyOn(history, 'state', 'get').mockReturnValue({ back })
  const router = createRouter({ history, routes })
  const spies = {
    back: vi.spyOn(router, 'back').mockImplementation(() => {}),
    replace: vi.spyOn(router, 'replace').mockResolvedValue(undefined),
  }
  return { router, ...spies }
}

test('goes back when the previous screen is the target, whatever its query', async () => {
  const { router, back, replace } = routerWithBack('/?q=%E5%B1%95&sort=company')

  await backTo(router, { name: 'cards' })

  expect(back).toHaveBeenCalledOnce()
  expect(replace).not.toHaveBeenCalled()
})

test('goes back to the same card only', async () => {
  const same = routerWithBack('/cards/c-1')
  await backTo(same.router, { name: 'card', params: { id: 'c-1' } })
  expect(same.back).toHaveBeenCalledOnce()

  const other = routerWithBack('/cards/c-2')
  await backTo(other.router, { name: 'card', params: { id: 'c-1' } })
  expect(other.back).not.toHaveBeenCalled()
  expect(other.replace).toHaveBeenCalledWith({ name: 'card', params: { id: 'c-1' } })
})

test('replaces the screen when there is no previous one', async () => {
  const { router, back, replace } = routerWithBack(null)

  await backTo(router, { name: 'cards' })

  expect(back).not.toHaveBeenCalled()
  expect(replace).toHaveBeenCalledWith({ name: 'cards' })
})

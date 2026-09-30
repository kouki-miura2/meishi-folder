import { describe, expect, it } from 'vite-plus/test'

import { emptyCardForm } from '../domain/card-form.ts'
import { forgetLastScene, loadLastScene, rememberScene } from './last-scene.ts'

const memoryStorage = (): Storage => {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

describe('last scene', () => {
  it('is empty before anything is saved', () => {
    expect(loadLastScene(memoryStorage())).toEqual({})
  })

  it('remembers the filled fields, trimmed', () => {
    const store = memoryStorage()
    rememberScene(
      { ...emptyCardForm(), metOn: '2026-09-30', metAt: ' 東京ビッグサイト ', metOccasion: '' },
      store,
    )
    expect(loadLastScene(store)).toEqual({ metOn: '2026-09-30', metAt: '東京ビッグサイト' })
  })

  it('keeps the older value of a field left empty', () => {
    const store = memoryStorage()
    rememberScene({ ...emptyCardForm(), metAt: '幕張メッセ', metOccasion: '展示会' }, store)
    rememberScene({ ...emptyCardForm(), metOccasion: '商談' }, store)
    expect(loadLastScene(store)).toEqual({ metAt: '幕張メッセ', metOccasion: '商談' })
  })

  it('ignores a broken or foreign value', () => {
    const store = memoryStorage()
    store.setItem('meishi:last-scene', '{"metAt":1,"other":"x"')
    expect(loadLastScene(store)).toEqual({})
    store.setItem('meishi:last-scene', '{"metAt":1,"metOn":"2026-09-30","other":"x"}')
    expect(loadLastScene(store)).toEqual({ metOn: '2026-09-30' })
  })

  it('is forgotten on sign-out', () => {
    const store = memoryStorage()
    rememberScene({ ...emptyCardForm(), metAt: '幕張メッセ' }, store)
    forgetLastScene(store)
    expect(loadLastScene(store)).toEqual({})
  })

  it('does nothing without storage', () => {
    expect(() => rememberScene(emptyCardForm(), null)).not.toThrow()
    expect(loadLastScene(null)).toEqual({})
  })
})

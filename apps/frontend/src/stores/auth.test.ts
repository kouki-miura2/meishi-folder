import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test } from 'vite-plus/test'

import { useAuthStore } from './auth.ts'

const inOneDay = () => Math.floor(Date.now() / 1000) + 24 * 3600

const profile = (expiresAt = inOneDay()) => ({
  email: 'y.yamada@gmail.com',
  name: '山田 陽子',
  picture: null,
  expiresAt,
})

beforeEach(() => {
  setActivePinia(createPinia())
})

test('starts signed out', () => {
  const auth = useAuthStore()

  expect(auth.profile).toBeNull()
  expect(auth.isSignedIn()).toBe(false)
})

test('signIn keeps the profile until it expires', () => {
  const auth = useAuthStore()

  auth.signIn(profile())

  expect(auth.profile?.name).toBe('山田 陽子')
  expect(auth.isSignedIn()).toBe(true)
})

test('a session past its expiry no longer counts as signed in', () => {
  const auth = useAuthStore()
  auth.signIn(profile(Math.floor(Date.now() / 1000) - 1))

  expect(auth.isSignedIn()).toBe(false)
})

test('signOut forgets the profile', () => {
  const auth = useAuthStore()
  auth.signIn(profile())

  auth.signOut()

  expect(auth.profile).toBeNull()
  expect(auth.isSignedIn()).toBe(false)
})

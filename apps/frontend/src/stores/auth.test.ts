import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test } from 'vite-plus/test'

import { decodeIdToken, useAuthStore } from './auth.ts'

const base64url = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** An unsigned token with the given claims; the store never checks signatures. */
const fakeToken = (claims: Record<string, unknown>) =>
  `${base64url({ alg: 'RS256' })}.${base64url(claims)}.signature`

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600

beforeEach(() => {
  setActivePinia(createPinia())
})

test('decodeIdToken reads the profile claims, Japanese names included', () => {
  const token = fakeToken({
    email: 'y.yamada@gmail.com',
    name: '山田 陽子',
    picture: 'https://example.com/a.png',
    exp: 2000000000,
  })

  expect(decodeIdToken(token)).toEqual({
    email: 'y.yamada@gmail.com',
    name: '山田 陽子',
    picture: 'https://example.com/a.png',
    expiresAt: 2000000000,
  })
})

test('decodeIdToken rejects malformed tokens and tokens without an expiry', () => {
  expect(decodeIdToken('not-a-token')).toBeNull()
  expect(decodeIdToken(fakeToken({ email: 'a@example.com' }))).toBeNull()
})

test('signIn keeps a valid token and exposes its profile', () => {
  const auth = useAuthStore()

  expect(auth.signIn(fakeToken({ email: 'a@example.com', exp: inOneHour() }))).toBe(true)

  expect(auth.profile?.email).toBe('a@example.com')
  expect(auth.hasValidToken()).toBe(true)
  expect(auth.validToken()).toBe(auth.token)
})

test('signIn refuses a token it cannot read', () => {
  const auth = useAuthStore()

  expect(auth.signIn('garbage')).toBe(false)
  expect(auth.token).toBeNull()
})

test('a token about to expire no longer counts as valid', () => {
  const auth = useAuthStore()
  auth.signIn(fakeToken({ exp: Math.floor(Date.now() / 1000) + 30 }))

  expect(auth.hasValidToken()).toBe(false)
  expect(auth.validToken()).toBeNull()
})

test('signOut forgets the token', () => {
  const auth = useAuthStore()
  auth.signIn(fakeToken({ exp: inOneHour() }))

  auth.signOut()

  expect(auth.token).toBeNull()
  expect(auth.profile).toBeNull()
})

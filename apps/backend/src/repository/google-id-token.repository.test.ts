import { sign } from 'hono/jwt'
import { expect, test } from 'vite-plus/test'

import { createGoogleIdTokenRepository } from './google-id-token.repository.ts'

const CLIENT_ID = 'client-id.apps.googleusercontent.com'

const createKeyPair = async (kid: string) => {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  const privateKey = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return {
    privateKey: { ...privateKey, kid, alg: 'RS256' },
    publicKey: { ...publicKey, kid, alg: 'RS256' },
  }
}

const { privateKey, publicKey } = await createKeyPair('key-1')
const repository = createGoogleIdTokenRepository({
  clientId: CLIENT_ID,
  loadKeys: async () => [publicKey],
})

const claims = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: 'google-user-1',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
})

test('accepts a valid Google ID token and reads the account from its claims', async () => {
  const token = await sign(
    claims({
      email: 'y.yamada@gmail.com',
      name: '山田 陽子',
      picture: 'https://example.com/a.png',
    }),
    privateKey,
  )

  await expect(repository.verify(token)).resolves.toEqual({
    id: 'google-user-1',
    email: 'y.yamada@gmail.com',
    name: '山田 陽子',
    picture: 'https://example.com/a.png',
  })
})

test('accepts the issuer without the https:// prefix', async () => {
  const token = await sign(claims({ iss: 'accounts.google.com' }), privateKey)

  await expect(repository.verify(token)).resolves.toEqual({
    id: 'google-user-1',
    email: '',
    name: '',
    picture: null,
  })
})

test('rejects something that is not a JWT', async () => {
  await expect(repository.verify('garbage')).resolves.toBeNull()
})

test.each([
  ['another audience', { aud: 'someone-else' }],
  ['another issuer', { iss: 'https://evil.example.com' }],
  ['an expired token', { exp: Math.floor(Date.now() / 1000) - 60 }],
])('rejects %s', async (_label, overrides) => {
  const token = await sign(claims(overrides), privateKey)

  await expect(repository.verify(token)).resolves.toBeNull()
})

test('rejects a token signed with an unknown key', async () => {
  const other = await createKeyPair('key-1')
  const token = await sign(claims(), other.privateKey)

  await expect(repository.verify(token)).resolves.toBeNull()
})

test('rejects when the keys cannot be loaded', async () => {
  const offline = createGoogleIdTokenRepository({
    clientId: CLIENT_ID,
    loadKeys: async () => {
      throw new Error('network down')
    },
  })
  const token = await sign(claims(), privateKey)

  await expect(offline.verify(token)).resolves.toBeNull()
})

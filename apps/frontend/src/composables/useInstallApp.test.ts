import { expect, test } from 'vite-plus/test'

import { installModeOf } from './useInstallApp.ts'

const iphoneSafari =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const iphoneChrome =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1'
const macSafari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const androidChrome =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'

const env = { standalone: false, hasPrompt: false, maxTouchPoints: 0 }

test('nothing to offer once opened from the home screen', () => {
  expect(
    installModeOf({ ...env, standalone: true, hasPrompt: true, userAgent: androidChrome }),
  ).toBe(null)
  expect(installModeOf({ ...env, standalone: true, userAgent: iphoneSafari })).toBe(null)
})

test('a browser with an install prompt installs directly', () => {
  expect(installModeOf({ ...env, hasPrompt: true, userAgent: androidChrome })).toBe('prompt')
})

test('iOS gets share-menu instructions, telling Safari from other browsers', () => {
  expect(installModeOf({ ...env, userAgent: iphoneSafari })).toBe('ios-safari')
  expect(installModeOf({ ...env, userAgent: iphoneChrome })).toBe('ios-other')
  // iPadOS Safari reports itself as a Mac with a touch screen.
  expect(installModeOf({ ...env, userAgent: macSafari, maxTouchPoints: 5 })).toBe('ios-safari')
})

test('hidden where the browser can neither prompt nor add to the home screen by hand', () => {
  expect(installModeOf({ ...env, userAgent: androidChrome })).toBe(null)
  expect(installModeOf({ ...env, userAgent: macSafari })).toBe(null)
})

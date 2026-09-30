import { computed, shallowRef } from 'vue'

/** Chromium's install prompt event; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallMode =
  /** The browser can install directly: show its own install prompt. */
  | 'prompt'
  /** iOS can't install from a script: show how to use the share menu instead. */
  | 'ios-safari'
  | 'ios-other'

interface Environment {
  /** Already opened from the home screen. */
  standalone: boolean
  hasPrompt: boolean
  userAgent: string
  maxTouchPoints: number
}

/** How the app can be installed here, or null when it is installed already or can't be. */
export const installModeOf = (env: Environment): InstallMode | null => {
  if (env.standalone) return null
  if (env.hasPrompt) return 'prompt'
  // iPadOS reports itself as a Mac; a touch screen tells them apart.
  const ios =
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1)
  if (!ios) return null
  // Every iOS browser says "Safari"; the others add their own token.
  return /CriOS|FxiOS|EdgiOS|OPiOS/.test(env.userAgent) ? 'ios-other' : 'ios-safari'
}

// Module state: the prompt event fires once, early, usually before the settings screen is open.
const deferredPrompt = shallowRef<BeforeInstallPromptEvent | null>(null)
const installed = shallowRef(false)

/** Starts catching the browser's install prompt; called once from `main.ts`. */
export const listenForInstallPrompt = () => {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's own banner from showing; the settings screen offers the install instead.
    event.preventDefault()
    deferredPrompt.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt.value = null
    installed.value = true
  })
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // iOS Safari's own flag for a home-screen launch.
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** The settings screen's "install the app" row: whether to show it, and what tapping it does. */
export const useInstallApp = () => {
  const mode = computed(() =>
    installModeOf({
      standalone: installed.value || isStandalone(),
      hasPrompt: !!deferredPrompt.value,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
    }),
  )

  /** Shows the browser's install prompt. The event can prompt only once, so it's dropped after. */
  const prompt = async () => {
    const event = deferredPrompt.value
    if (!event) return
    deferredPrompt.value = null
    await event.prompt()
  }

  return { mode, prompt }
}

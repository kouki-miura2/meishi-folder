import { VueQueryPlugin, focusManager } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { configureApiClient } from './api/client.ts'
import App from './App.vue'
import { listenForInstallPrompt } from './composables/useInstallApp.ts'
import { adoptDataVersion, queryClient, syncDataVersion } from './plugins/query.ts'
import { vuetify } from './plugins/vuetify.ts'
import { router } from './router/index.ts'
import { useAuthStore } from './stores/auth.ts'

const pinia = createPinia()
const app = createApp(App).use(pinia)
const auth = useAuthStore(pinia)

configureApiClient({
  // The session expired: sign in again, then come back to the same screen.
  onUnauthorized: () => {
    auth.signOut()
    queryClient.clear()
    const current = router.currentRoute.value
    if (current.name !== 'login') {
      void router.replace({ name: 'login', query: { redirect: current.fullPath } })
    }
  },
  onDataVersion: adoptDataVersion,
})

// Whether data cached on this device is still current, checked on opening a screen and on coming
// back to the app (a change made on another device). Offline, the cache just stays as it is.
const syncIfSignedIn = () => {
  if (auth.isSignedIn()) syncDataVersion().catch(() => {})
}
router.afterEach(syncIfSignedIn)
focusManager.subscribe((focused) => {
  if (focused) syncIfSignedIn()
})

listenForInstallPrompt()

app.use(router).use(vuetify).use(VueQueryPlugin, { queryClient }).mount('#app')

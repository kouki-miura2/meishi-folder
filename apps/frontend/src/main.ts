import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { configureApiClient } from './api/client.ts'
import App from './App.vue'
import { listenForInstallPrompt } from './composables/useInstallApp.ts'
import { queryClient } from './plugins/query.ts'
import { vuetify } from './plugins/vuetify.ts'
import { router } from './router/index.ts'
import { useAuthStore } from './stores/auth.ts'

const pinia = createPinia()
const app = createApp(App).use(pinia)
const auth = useAuthStore(pinia)

configureApiClient({
  getToken: () => auth.validToken(),
  // The ID token expired or was revoked: sign in again, then come back to the same screen.
  onUnauthorized: () => {
    auth.signOut()
    queryClient.clear()
    const current = router.currentRoute.value
    if (current.name !== 'login') {
      void router.replace({ name: 'login', query: { redirect: current.fullPath } })
    }
  },
})

listenForInstallPrompt()

app.use(router).use(vuetify).use(VueQueryPlugin, { queryClient }).mount('#app')

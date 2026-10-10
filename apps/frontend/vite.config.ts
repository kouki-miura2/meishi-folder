import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import vuetify from 'vite-plugin-vuetify'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    // Service worker: detects a new build and waits for the person to tap "更新"
    // (`registerType: 'prompt'`, `usePwaUpdate`). `/api` is never cached. Off in `vp dev`.
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // The SPA fallback must not answer the API.
        navigateFallbackDenylist: [/^\/api\//],
      },
      // The home-screen manifest is the hand-written `public/manifest.webmanifest`.
      manifest: false,
    }),
  ],
  optimizeDeps: {
    exclude: ['vuetify'],
  },
  // Same origin as in production: /api goes to the backend Worker (`vp run backend-worker#dev`).
  server: { proxy: { '/api': 'http://localhost:8787' } },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
})

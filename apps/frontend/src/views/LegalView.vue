<script setup lang="ts">
import { useRouter } from 'vue-router'

import LegalDocument from '../components/LegalDocument.vue'
import type { LegalDocumentKind } from '../legal/documents.ts'

// Not in the design: the terms of service and privacy policy. Public, so they can be read before
// signing in. Opened in the same window (from the home screen there are no tabs to go back to), so
// it has its own way back: to the previous screen, or into the app when opened directly.
defineProps<{ kind: LegalDocumentKind }>()

const router = useRouter()
const back = () =>
  router.options.history.state.back ? router.back() : router.replace({ name: 'cards' })
</script>

<template>
  <div class="top-bar border-0">
    <v-btn icon="mdi-chevron-left" variant="text" aria-label="戻る" @click="back" />
  </div>
  <LegalDocument :kind="kind" />
</template>

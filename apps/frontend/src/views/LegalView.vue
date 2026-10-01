<script setup lang="ts">
import { computed } from 'vue'

import { legalDocuments, type LegalDocumentKind } from '../legal/documents.ts'

// Not in the design: the terms of service and privacy policy. Public, so they can be read before
// signing in; opened in a new tab from the welcome and settings screens.
const props = defineProps<{ kind: LegalDocumentKind }>()

const doc = computed(() => legalDocuments[props.kind])
</script>

<template>
  <div class="page legal">
    <h1 class="page-title">{{ doc.title }}</h1>
    <p class="faint text-caption">{{ doc.revisedOn.replace(/-/g, '/') }} 制定</p>
    <p>{{ doc.intro }}</p>
    <section v-for="section in doc.sections" :key="section.heading">
      <h2 class="legal__heading">{{ section.heading }}</h2>
      <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
      <ul v-if="section.items" class="legal__items">
        <li v-for="item in section.items" :key="item">{{ item }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.legal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 24px;
  font-size: 14px;
  line-height: 1.8;
}
.legal section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legal__heading {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 700;
}
.legal__items {
  padding-left: 1.4em;
}
</style>

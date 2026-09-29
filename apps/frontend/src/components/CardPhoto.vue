<script setup lang="ts">
import { toRef } from 'vue'

import { useCardImageUrl } from '../composables/useCards.ts'

const props = defineProps<{ imageId: string | null; label: string }>()

const { url, isLoading } = useCardImageUrl(toRef(props, 'imageId'))
</script>

<template>
  <div class="card-photo">
    <img v-if="url" :src="url" :alt="`名刺写真（${label}）`" />
    <v-progress-circular v-else-if="isLoading" indeterminate size="24" color="secondary" />
    <span v-else class="mono faint">{{ label }}</span>
  </div>
</template>

<style scoped>
.card-photo {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 6px;
  overflow: hidden;
  font-size: 11px;
}
.card-photo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>

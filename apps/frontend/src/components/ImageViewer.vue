<script setup lang="ts">
import { computed, ref } from 'vue'

import CardPhoto from './CardPhoto.vue'

// 1j: the card photos full screen. Zoom is the browser's own pinch zoom; rotating is for viewing
// only and is not saved.
const props = defineProps<{ imageIds: string[]; start: number }>()
const emit = defineEmits<{ close: [] }>()

const index = ref(props.start)
const rotation = ref(0)
const labels = ['表', '裏']
const current = computed(() => props.imageIds[index.value] ?? null)

const show = (i: number) => {
  index.value = i
  rotation.value = 0
}
</script>

<template>
  <v-dialog :model-value="true" fullscreen @update:model-value="emit('close')">
    <div class="viewer">
      <div class="viewer__bar">
        <v-btn
          icon="mdi-close"
          variant="text"
          color="white"
          aria-label="閉じる"
          @click="emit('close')"
        />
        <span class="mono">{{ labels[index] }} {{ index + 1 }} / {{ imageIds.length }}</span>
        <v-btn
          icon="mdi-rotate-right"
          variant="text"
          color="white"
          aria-label="回転"
          @click="rotation += 90"
        />
      </div>
      <div class="viewer__stage">
        <div class="viewer__photo" :style="{ transform: `rotate(${rotation}deg)` }">
          <CardPhoto :image-id="current" :label="labels[index] ?? ''" />
        </div>
      </div>
      <div v-if="imageIds.length > 1" class="viewer__thumbs">
        <button
          v-for="(id, i) in imageIds"
          :key="id"
          type="button"
          class="viewer__thumb"
          :class="{ 'viewer__thumb--active': i === index }"
          :aria-label="`${labels[i]}を表示`"
          @click="show(i)"
        >
          <CardPhoto :image-id="id" :label="labels[i] ?? ''" />
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<style scoped>
.viewer {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #0e0e0d;
  color: #f5f3ee;
  touch-action: pinch-zoom;
}
.viewer__bar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  font-size: 13px;
}
.viewer__stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  overflow: hidden;
}
.viewer__photo {
  width: 100%;
  aspect-ratio: 91 / 55;
  transition: transform 0.2s;
}
.viewer__photo:has(.card-photo--portrait) {
  /* As tall as the stage allows, but no wider than the screen. */
  width: auto;
  height: min(100%, calc((100vw - 20px) * 91 / 55));
  aspect-ratio: 55 / 91;
}
.viewer__thumbs {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 0 20px calc(40px + env(safe-area-inset-bottom));
}
.viewer__thumb {
  width: 72px;
  height: 44px;
  opacity: 0.5;
}
.viewer__thumb:has(.card-photo--portrait) {
  width: 44px;
  height: 72px;
}
.viewer__thumb--active {
  opacity: 1;
  outline: 2px solid #f5f3ee;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>

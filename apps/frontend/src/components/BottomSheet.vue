<script setup lang="ts">
import { computed, ref } from 'vue'

// A bottom sheet whose handle can be dragged or flicked down to close it. Vuetify's
// v-bottom-sheet has no swipe gesture, and without one a drag on the handle scrolls the page behind.
const emit = defineEmits<{ close: [] }>()

const offset = ref(0)
const drag = ref<{ y: number; t: number }>()

const onDown = (e: PointerEvent) => {
  drag.value = { y: e.clientY, t: e.timeStamp }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
const onMove = (e: PointerEvent) => {
  if (drag.value) offset.value = Math.max(0, e.clientY - drag.value.y)
}
const onUp = (e: PointerEvent) => {
  if (!drag.value) return
  const velocity = offset.value / Math.max(1, e.timeStamp - drag.value.t) // px/ms
  drag.value = undefined
  if (offset.value > 120 || (offset.value > 20 && velocity > 0.5)) emit('close')
  else offset.value = 0
}
const onCancel = () => {
  drag.value = undefined
  offset.value = 0
}

const style = computed(() => ({
  transform: offset.value ? `translateY(${offset.value}px)` : undefined,
  transition: drag.value ? 'none' : 'transform 0.2s ease',
}))
</script>

<template>
  <v-bottom-sheet :model-value="true" @update:model-value="emit('close')">
    <div class="sheet" :style="style">
      <div
        class="sheet__handle"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onCancel"
      />
      <slot />
    </div>
  </v-bottom-sheet>
</template>

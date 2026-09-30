<script setup lang="ts">
// Under a printed item that a new photo changed: what it was before, and a way back to it.
defineProps<{ before: string }>()
defineEmits<{ restore: [] }>()
</script>

<template>
  <div class="printed-change">
    <v-chip color="primary" variant="outlined" size="x-small" class="flex-0-0">変更</v-chip>
    <span class="printed-change__before">変更前: {{ before || '（なし）' }}</span>
    <v-btn variant="text" size="x-small" class="flex-0-0" @click="$emit('restore')">戻す</v-btn>
  </div>
</template>

<style scoped>
.printed-change {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: -6px;
  font-size: 12px;
  color: var(--muted);
}
.printed-change__before {
  flex: 1;
  min-width: 0;
  text-decoration: line-through;
  overflow-wrap: anywhere;
}
</style>

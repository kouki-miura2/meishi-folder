<script setup lang="ts">
// Related projects (red) and groups (blue), the two topic colors of the design.
defineProps<{ projects: string[]; groups: string[]; size?: 'x-small' | 'small' }>()
</script>

<template>
  <div v-if="projects.length || groups.length" class="topic-chips">
    <v-chip v-for="p in projects" :key="`p-${p}`" color="project" :size="size ?? 'x-small'">
      {{ p }}
    </v-chip>
    <v-chip v-for="g in groups" :key="`g-${g}`" color="group" :size="size ?? 'x-small'">
      {{ g }}
    </v-chip>
  </div>
</template>

<style scoped>
.topic-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>

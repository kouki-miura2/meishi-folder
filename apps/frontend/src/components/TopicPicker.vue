<script setup lang="ts">
import { computed, ref } from 'vue'

// Related projects or groups, GitHub-topic style: pick an existing one or type a new one.
// Picking from the list, Enter or leaving the field adds it. Not the list closing: it also closes
// when typing leaves nothing to suggest, which would end the input mid-word.
const model = defineModel<string[]>({ required: true })

const props = defineProps<{ kind: 'project' | 'group'; options: string[] }>()

const adding = ref(false)
const draft = ref<string | null>(null)
const color = computed(() => (props.kind === 'project' ? 'project' : 'group'))
const choices = computed(() => props.options.filter((o) => !model.value.includes(o)))

const add = (picked?: string) => {
  const name = (picked ?? draft.value)?.trim()
  if (name && !model.value.includes(name)) model.value = [...model.value, name]
  draft.value = null
  adding.value = false
}
</script>

<template>
  <div class="topic-picker">
    <v-chip
      v-for="name in model"
      :key="name"
      :color="color"
      size="small"
      closable
      @click:close="model = model.filter((n) => n !== name)"
    >
      {{ name }}
    </v-chip>
    <v-combobox
      v-if="adding"
      v-model="draft"
      :items="choices"
      autofocus
      density="compact"
      placeholder="名前を入力"
      class="topic-picker__input"
      @keydown.enter.prevent="add()"
      @item:added="(item: { title: string }) => add(item.title)"
      @blur="add()"
    />
    <v-chip v-else :color="color" size="small" variant="outlined" @click="adding = true">
      ＋ 追加
    </v-chip>
  </div>
</template>

<style scoped>
.topic-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.topic-picker__input {
  flex: 1 1 100%;
}
</style>

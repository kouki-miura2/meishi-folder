<script setup lang="ts">
// A list of free-text values (emails, titles, other contacts): one field each, add and remove.
const model = defineModel<string[]>({ required: true })

defineProps<{ label: string; type?: string; mono?: boolean; review?: boolean }>()

const update = (index: number, value: string) => {
  model.value = model.value.map((v, i) => (i === index ? value : v))
}
const remove = (index: number) => {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="string-list">
    <v-text-field
      v-for="(value, index) in model"
      :key="index"
      :model-value="value"
      :label="index === 0 ? label : undefined"
      :type="type"
      :class="{ mono }"
      @update:model-value="update(index, $event)"
    >
      <template #append-inner>
        <v-chip v-if="review" color="caution" size="x-small" class="mr-1">要確認</v-chip>
        <v-btn
          icon="mdi-minus"
          variant="text"
          size="small"
          :aria-label="`${label}を削除`"
          @click="remove(index)"
        />
      </template>
    </v-text-field>
    <v-btn variant="text" class="px-1" prepend-icon="mdi-plus" @click="model = [...model, '']">
      {{ label }}を追加
    </v-btn>
  </div>
</template>

<style scoped>
.string-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.string-list > .v-btn {
  align-self: flex-start;
}
</style>

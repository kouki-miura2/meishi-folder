<script setup lang="ts">
import { ref } from 'vue'

// Asks for one name: adding or renaming a company / department.
const props = defineProps<{ title: string; initial?: string; saving?: boolean }>()
const emit = defineEmits<{ save: [name: string]; close: [] }>()

const name = ref(props.initial ?? '')
const submit = () => {
  if (name.value.trim()) emit('save', name.value.trim())
}
</script>

<template>
  <v-dialog :model-value="true" max-width="400" @update:model-value="emit('close')">
    <v-card :title="title">
      <v-card-text>
        <v-text-field v-model="name" autofocus label="名称" @keydown.enter="submit" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">キャンセル</v-btn>
        <v-btn color="primary" :disabled="!name.trim()" :loading="saving" @click="submit"
          >保存</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

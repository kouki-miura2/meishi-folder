<script setup lang="ts">
import { formatDate } from 'utils'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CardFormFields from '../components/CardFormFields.vue'
import DeleteCardDialog from '../components/DeleteCardDialog.vue'
import { useCardQuery, useUpdateCardMutation } from '../composables/useCards.ts'
import {
  type CardForm,
  emptyCardForm,
  formFromCard,
  toUpdateInput,
  validateCardForm,
} from '../domain/card-form.ts'

// 1i: every field of a card, editable; plus deleting it.
const props = defineProps<{ id: string }>()
const router = useRouter()

const { data: card } = useCardQuery(() => props.id)
const update = useUpdateCardMutation()

const form = ref<CardForm>(emptyCardForm())
const loaded = ref(false)
watch(
  card,
  (value) => {
    // Load once: a background refetch must not wipe edits in progress.
    if (!value || loaded.value) return
    form.value = formFromCard(value)
    loaded.value = true
  },
  { immediate: true },
)

const errors = computed(() => validateCardForm(form.value))
const confirmDelete = ref(false)
const stamp = (iso?: string) => (iso ? formatDate(new Date(iso), 'yyyy-MM-dd HH:mm') : '')

const save = async () => {
  await update.mutateAsync({ id: props.id, input: toUpdateInput(form.value) })
  await router.replace({ name: 'card', params: { id: props.id } })
}
</script>

<template>
  <div class="top-bar">
    <v-btn variant="text" class="muted" @click="router.back()">キャンセル</v-btn>
    <span class="top-bar__title">編集</span>
    <v-btn
      color="primary"
      rounded="pill"
      size="small"
      :disabled="!loaded || errors.length > 0"
      :loading="update.isPending.value"
      @click="save"
    >
      保存
    </v-btn>
  </div>

  <div v-if="!loaded" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="secondary" />
  </div>
  <div v-else class="page">
    <v-alert
      v-for="error in errors"
      :key="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-2 mt-3"
    >
      {{ error }}
    </v-alert>
    <CardFormFields v-model="form" :sections="['printed', 'scene', 'notes', 'visibility']" />

    <div class="mono faint text-caption mt-4">
      registered {{ stamp(card?.createdAt) }}<br />
      updated&nbsp;&nbsp;&nbsp; {{ stamp(card?.updatedAt) }}
    </div>
    <v-btn
      block
      variant="outlined"
      color="error"
      class="mt-4 mb-4"
      height="50"
      @click="confirmDelete = true"
    >
      この名刺を削除
    </v-btn>
  </div>

  <DeleteCardDialog v-model="confirmDelete" :card-id="id" />
</template>

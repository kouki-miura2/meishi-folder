<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useDeleteCardMutation } from '../composables/useCards.ts'

// Confirms and deletes a card (photos included), then returns to the list.
const open = defineModel<boolean>({ required: true })
const props = defineProps<{ cardId: string }>()

const router = useRouter()
const remove = useDeleteCardMutation()

const deleteCard = async () => {
  await remove.mutateAsync(props.cardId)
  open.value = false
  await router.replace({ name: 'cards' })
}
</script>

<template>
  <v-dialog v-model="open" max-width="360">
    <v-card title="この名刺を削除しますか？" text="名刺写真も削除され、元に戻せません。">
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">キャンセル</v-btn>
        <v-btn color="error" :loading="remove.isPending.value" @click="deleteCard">削除</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

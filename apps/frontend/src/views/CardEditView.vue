<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { formatDate } from 'utils'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import CameraCapture from '../components/CameraCapture.vue'
import CardFormFields from '../components/CardFormFields.vue'
import CardPhoto from '../components/CardPhoto.vue'
import DeleteCardDialog from '../components/DeleteCardDialog.vue'
import ExtractionProgress from '../components/ExtractionProgress.vue'
import {
  fetchCardImage,
  useCardQuery,
  useExtractCardMutation,
  useUpdateCardMutation,
  useUploadImageMutation,
} from '../composables/useCards.ts'
import { companiesQueryOptions } from '../composables/useMasters.ts'
import {
  type CardForm,
  type CardImages,
  type ReviewField,
  changedPrintedFields,
  emptyCardForm,
  fieldsToReview,
  formFromCard,
  overwritePrinted,
  toUpdateInput,
  validateCardForm,
} from '../domain/card-form.ts'
import { resizeImage, rotateImage } from '../lib/image.ts'
import { rememberScene } from '../lib/last-scene.ts'
import { backTo } from '../router/back.ts'
import { useNotificationStore } from '../stores/notification.ts'

// 1i: every field of a card, editable; plus deleting it. The photos can be turned 90° or retaken,
// and a retake is read by the AI again: the printed items are overwritten, each change marked.
const props = defineProps<{ id: string }>()
const router = useRouter()
const queryClient = useQueryClient()
const notification = useNotificationStore()

const { data: card } = useCardQuery(() => props.id)
const update = useUpdateCardMutation()
const upload = useUploadImageMutation()
const extract = useExtractCardMutation()

const form = ref<CardForm>(emptyCardForm())
const images = ref<CardImages>({ frontImageId: null, backImageId: null })
// The card as saved; once a retake overwrites the printed items, `before` holds it to mark the changes.
const saved = shallowRef<CardForm | null>(null)
const before = shallowRef<CardForm | null>(null)
const loaded = ref(false)
watch(
  card,
  (value) => {
    // Load once: a background refetch must not wipe edits in progress.
    if (!value || loaded.value) return
    form.value = formFromCard(value)
    saved.value = formFromCard(value)
    images.value = { frontImageId: value.frontImageId, backImageId: value.backImageId }
    loaded.value = true
  },
  { immediate: true },
)

const step = ref<'edit' | 'capture' | 'extracting'>('edit')
const progress = ref(0)
const uploading = ref(false)
const review = ref(new Set<ReviewField>())
let skipped = false

const errors = computed(() => validateCardForm(form.value))
const changedCount = computed(() =>
  before.value ? changedPrintedFields(before.value, form.value).size : 0,
)
const confirmDelete = ref(false)
const stamp = (iso?: string) => (iso ? formatDate(new Date(iso), 'yyyy-MM-dd HH:mm') : '')
const sides = [
  { key: 'frontImageId', label: '表' },
  { key: 'backImageId', label: '裏' },
] as const

const uploadPhoto = async (photo: Blob, name: string) =>
  (await upload.mutateAsync(await resizeImage(photo, name))).id

// A new back is optional: skipping it keeps the back the card has.
const retake = async (front: Blob, back: Blob | null) => {
  step.value = 'extracting'
  progress.value = 0
  skipped = false
  uploading.value = true
  let next: CardImages
  try {
    const [frontImageId, backImageId] = await Promise.all([
      uploadPhoto(front, 'front.jpg'),
      back ? uploadPhoto(back, 'back.jpg') : images.value.backImageId,
    ])
    next = { frontImageId, backImageId }
    images.value = next
  } catch {
    if (!skipped) step.value = 'capture'
    return
  } finally {
    uploading.value = false
  }
  if (skipped) return
  progress.value = 1
  try {
    const extracted = await extract.mutateAsync({
      frontImageId: next.frontImageId ?? '',
      backImageId: next.backImageId,
    })
    if (skipped) return
    progress.value = 2
    await queryClient.prefetchQuery(companiesQueryOptions)
    form.value = overwritePrinted(form.value, extracted)
    before.value = saved.value
    review.value = fieldsToReview(form.value)
  } catch {
    if (skipped) return
    notification.show('名刺を読み取れませんでした。記載項目は変わっていません')
  }
  step.value = 'edit'
}

const skip = () => {
  skipped = true
  step.value = 'edit'
}

// A photo at the wrong angle is turned 90° clockwise and uploaded again; saving waits for it.
const rotate = async (key: keyof CardImages) => {
  const id = images.value[key]
  if (!id) return
  uploading.value = true
  try {
    const photo = await rotateImage(await fetchCardImage(queryClient, id))
    images.value = {
      ...images.value,
      [key]: await uploadPhoto(photo, key === 'frontImageId' ? 'front.jpg' : 'back.jpg'),
    }
  } finally {
    uploading.value = false
  }
}

// Sending the photos unchanged is a no-op; a replaced photo is deleted by the API.
const save = async () => {
  await update.mutateAsync({
    id: props.id,
    input: { ...toUpdateInput(form.value), ...images.value },
  })
  rememberScene(form.value)
  await backTo(router, { name: 'card', params: { id: props.id } })
}
</script>

<template>
  <CameraCapture v-if="step === 'capture'" keep-back @done="retake" @cancel="step = 'edit'" />

  <ExtractionProgress
    v-else-if="step === 'extracting'"
    :step="progress"
    :steps="['画像をアップロード', '記載項目をAIで抽出', '会社・部署マスタと照合']"
    @skip="skip"
  />

  <template v-else>
    <div class="top-bar">
      <v-btn variant="text" class="muted" @click="backTo(router, { name: 'card', params: { id } })"
        >キャンセル</v-btn
      >
      <span class="top-bar__title">編集</span>
      <v-btn
        color="primary"
        rounded="pill"
        size="small"
        :disabled="!loaded || errors.length > 0 || uploading"
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
      <div class="section-title">名刺写真</div>
      <div class="thumbs">
        <div v-for="side in sides" :key="side.key" class="thumb">
          <CardPhoto :image-id="images[side.key]" :label="side.label" />
          <v-btn
            v-if="images[side.key]"
            icon="mdi-rotate-right"
            size="x-small"
            color="primary"
            class="thumb__rotate"
            :aria-label="`${side.label}を右に90°回転`"
            :disabled="uploading"
            @click="rotate(side.key)"
          />
        </div>
        <v-progress-circular
          v-if="uploading"
          indeterminate
          size="20"
          color="secondary"
          class="align-self-center"
        />
      </div>
      <div class="d-flex align-center ga-2 mt-2">
        <v-btn
          variant="outlined"
          size="small"
          prepend-icon="mdi-camera-outline"
          :disabled="uploading"
          @click="step = 'capture'"
        >
          撮り直す
        </v-btn>
        <span class="faint text-caption">撮り直すとAIが記載項目を読み取り直します</span>
      </div>

      <div v-if="before" class="caution-note mt-3">
        <b>AIの読み取りで{{ changedCount }}項目が変わりました。</b>
        「変更」の項目を確認し、必要なら「戻す」で元の値に戻してください。
      </div>
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
      <CardFormFields
        v-model="form"
        :sections="['printed', 'scene', 'notes', 'memo', 'visibility']"
        :review="review"
        :before="before"
        :show-master-status="!!before"
      />

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
  </template>

  <DeleteCardDialog v-model="confirmDelete" :card-id="id" />
</template>

<style scoped>
.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.thumb {
  position: relative;
  height: 100px;
  aspect-ratio: 91 / 55;
}
/* A portrait card gets a tall frame, so it shows whole. */
.thumb:has(.card-photo--portrait) {
  aspect-ratio: 55 / 91;
}
.thumb__rotate {
  position: absolute;
  right: 4px;
  bottom: 4px;
}
</style>

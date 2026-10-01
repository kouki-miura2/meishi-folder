<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { LIMITS, formatDate } from 'utils'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { cardLimitMessage } from '../api/errors.ts'
import type { CardSummary } from '../api/types.ts'
import CameraCapture from '../components/CameraCapture.vue'
import CandidateSheet, { type CandidateChoice } from '../components/CandidateSheet.vue'
import CardFormFields from '../components/CardFormFields.vue'
import ExtractionProgress from '../components/ExtractionProgress.vue'
import {
  fetchCandidates,
  fetchCardCount,
  useCreateCardMutation,
  useExtractCardMutation,
  useUpdateCardMutation,
  useUploadImageMutation,
} from '../composables/useCards.ts'
import { companiesQueryOptions } from '../composables/useMasters.ts'
import {
  type CardForm,
  type CardImages,
  type ReviewField,
  emptyCardForm,
  fieldsToReview,
  formFromExtracted,
  toCreateInput,
  toOverwriteInput,
  validateCardForm,
} from '../domain/card-form.ts'
import { resizeImage, rotateImage } from '../lib/image.ts'
import { rememberScene } from '../lib/last-scene.ts'
import { backTo } from '../router/back.ts'
import { useNotificationStore } from '../stores/notification.ts'

// 1d–1g in one screen: capture → upload and AI extraction → confirm and correct → (same-person
// check) → save. The steps share photos and the form, so they live here rather than in routes.
const router = useRouter()
const queryClient = useQueryClient()
const notification = useNotificationStore()
const upload = useUploadImageMutation()
const extract = useExtractCardMutation()
const create = useCreateCardMutation()
const update = useUpdateCardMutation()

const step = ref<'capture' | 'extracting' | 'confirm'>('capture')
const progress = ref(0)
// The photos as taken (front, then back if any), and their object URLs for the thumbnails.
let photos: Blob[] = []
const previews = ref<string[]>([])
const rotating = ref(false)
const form = ref<CardForm>(emptyCardForm())
const review = ref(new Set<ReviewField>())
const extractedCount = ref<number | null>(null)
const candidates = ref<CardSummary[]>([])
const saving = ref(false)
// Uploads keep going if the user skips extraction; saving waits for them.
let uploads: Promise<CardImages> | null = null
let skipped = false

// At the card limit, say so before any photo is taken rather than when saving. The API checks too.
const atLimit = ref(false)
onMounted(async () => {
  atLimit.value = (await fetchCardCount(queryClient).catch(() => 0)) >= LIMITS.cardsPerUser
})

const today = () => formatDate(new Date())
const errors = computed(() => validateCardForm(form.value))

const setPhotos = (next: Blob[]) => {
  photos = next
  previews.value.forEach((url) => URL.revokeObjectURL(url))
  previews.value = next.map((photo) => URL.createObjectURL(photo))
}
onBeforeUnmount(() => setPhotos([]))

const uploadPhotos = async ([front, back]: Blob[]): Promise<CardImages> => {
  const [frontFile, backFile] = await Promise.all([
    front ? resizeImage(front, 'front.jpg') : null,
    back ? resizeImage(back, 'back.jpg') : null,
  ])
  const [frontImage, backImage] = await Promise.all([
    frontFile ? upload.mutateAsync(frontFile) : null,
    backFile ? upload.mutateAsync(backFile) : null,
  ])
  return { frontImageId: frontImage?.id ?? null, backImageId: backImage?.id ?? null }
}

const toConfirm = (next: CardForm, reviewFields = new Set<ReviewField>()) => {
  form.value = next
  review.value = reviewFields
  step.value = 'confirm'
}

const start = async (front: Blob, back: Blob | null) => {
  setPhotos(back ? [front, back] : [front])
  step.value = 'extracting'
  progress.value = 0
  skipped = false
  extractedCount.value = null
  uploads = uploadPhotos(photos)

  let images: CardImages
  try {
    images = await uploads
  } catch {
    uploads = null
    step.value = 'capture'
    return
  }
  if (skipped) return
  progress.value = 1
  try {
    const extracted = await extract.mutateAsync({
      frontImageId: images.frontImageId ?? '',
      backImageId: images.backImageId,
    })
    if (skipped) return
    progress.value = 2
    const next = formFromExtracted(extracted, today())
    await queryClient.prefetchQuery(companiesQueryOptions)
    progress.value = 3
    if (next.name.trim()) await fetchCandidates(queryClient, next.name.trim()).catch(() => [])
    if (skipped) return
    extractedCount.value = Object.values(extracted).filter((v) =>
      Array.isArray(v) ? v.length > 0 : v !== null,
    ).length
    toConfirm(next, fieldsToReview(next))
  } catch {
    if (skipped) return
    notification.show('名刺を読み取れませんでした。内容を入力してください')
    toConfirm({ ...emptyCardForm(), metOn: today() })
  }
}

const skip = () => {
  skipped = true
  toConfirm({ ...emptyCardForm(), metOn: today() })
}

// A shot taken at the wrong angle is turned 90° clockwise and uploaded again; saving waits for it.
const rotate = async (index: number) => {
  const photo = photos[index]
  if (!photo) return
  rotating.value = true
  try {
    setPhotos(photos.with(index, await rotateImage(photo)))
    uploads = uploadPhotos(photos)
  } finally {
    rotating.value = false
  }
}

const images = async (): Promise<CardImages> => {
  try {
    return uploads ? await uploads : { frontImageId: null, backImageId: null }
  } catch {
    return { frontImageId: null, backImageId: null }
  }
}

const save = async () => {
  saving.value = true
  try {
    const name = form.value.name.trim()
    const found = name ? await fetchCandidates(queryClient, name) : []
    if (found.length) {
      candidates.value = found
      return
    }
    const card = await create.mutateAsync(toCreateInput(form.value, await images()))
    rememberScene(form.value)
    await router.replace({ name: 'card', params: { id: card.id } })
  } finally {
    saving.value = false
  }
}

const choose = async (choice: CandidateChoice) => {
  saving.value = true
  try {
    const card =
      choice.mode === 'new'
        ? await create.mutateAsync(toCreateInput(form.value, await images()))
        : await update.mutateAsync({
            id: choice.cardId,
            input: toOverwriteInput(form.value, await images()),
          })
    if (choice.mode === 'new') rememberScene(form.value)
    candidates.value = []
    await router.replace({ name: 'card', params: { id: card.id } })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <CameraCapture
    v-if="step === 'capture'"
    @done="start"
    @cancel="backTo(router, { name: 'cards' })"
  />

  <ExtractionProgress v-else-if="step === 'extracting'" :step="progress" @skip="skip" />

  <template v-else>
    <div class="top-bar">
      <v-btn
        icon="mdi-chevron-left"
        variant="text"
        aria-label="撮り直す"
        @click="step = 'capture'"
      />
      <span class="top-bar__title">内容を確認</span>
      <span style="width: 44px" />
    </div>
    <div class="page">
      <div class="thumbs">
        <div v-for="(url, i) in previews" :key="url" class="thumb">
          <img :src="url" :alt="i === 0 ? '表' : '裏'" />
          <v-btn
            icon="mdi-rotate-right"
            size="x-small"
            color="primary"
            class="thumb__rotate"
            :aria-label="`${i === 0 ? '表' : '裏'}を右に90°回転`"
            :disabled="rotating"
            @click="rotate(i)"
          />
        </div>
      </div>
      <div class="faint text-caption mt-1">写真の向きが違うときは ↻ で右に90°回転できます</div>
      <div v-if="extractedCount !== null" class="caution-note mt-3">
        <b>AIが{{ extractedCount }}項目を抽出しました。</b>
        <template v-if="review.size"
          >「要確認」の項目は読み取りを誤っている可能性があるため確認してください。</template
        >
      </div>
      <v-alert
        v-for="error in errors"
        :key="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mt-3"
      >
        {{ error }}
      </v-alert>
      <CardFormFields
        v-model="form"
        :sections="['printed', 'scene', 'notes', 'memo']"
        :review="review"
        show-master-status
      />
    </div>
    <div class="bottom-bar">
      <v-btn
        color="primary"
        class="main-action flex-grow-1"
        :disabled="errors.length > 0 || rotating"
        :loading="saving"
        @click="save"
      >
        保存する
      </v-btn>
    </div>
  </template>

  <CandidateSheet
    v-if="candidates.length"
    :candidates="candidates"
    :current="{
      name: form.name,
      companyName: form.companyName,
      titles: form.titles,
      metOn: form.metOn,
    }"
    :saving="saving"
    @choose="choose"
    @close="candidates = []"
  />

  <v-dialog :model-value="atLimit" max-width="360" persistent>
    <v-card title="登録数の上限です">
      <v-card-text>{{ cardLimitMessage }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="backTo(router, { name: 'cards' })">名刺一覧に戻る</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.thumbs {
  display: flex;
  gap: 10px;
  padding-top: 14px;
}
.thumb {
  position: relative;
  max-width: calc(50% - 5px);
}
.thumb__rotate {
  position: absolute;
  right: 4px;
  bottom: 4px;
}
.thumb img {
  /* Width follows the photo, so a portrait card shows whole instead of cropped. */
  display: block;
  height: 100px;
  max-width: 100%;
  object-fit: contain;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 4px;
}
</style>

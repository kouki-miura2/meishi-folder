<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { formatDate } from 'utils'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { CardSummary } from '../api/types.ts'
import CameraCapture from '../components/CameraCapture.vue'
import CandidateSheet, { type CandidateChoice } from '../components/CandidateSheet.vue'
import CardFormFields from '../components/CardFormFields.vue'
import ExtractionProgress from '../components/ExtractionProgress.vue'
import {
  fetchCandidates,
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
import { resizeImage } from '../lib/image.ts'
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
const previews = ref<string[]>([])
const form = ref<CardForm>(emptyCardForm())
const review = ref(new Set<ReviewField>())
const extractedCount = ref<number | null>(null)
const candidates = ref<CardSummary[]>([])
const saving = ref(false)
// Uploads keep going if the user skips extraction; saving waits for them.
let uploads: Promise<CardImages> | null = null
let skipped = false

const today = () => formatDate(new Date())
const errors = computed(() => validateCardForm(form.value))

const setPreviews = (photos: Blob[]) => {
  previews.value.forEach((url) => URL.revokeObjectURL(url))
  previews.value = photos.map((photo) => URL.createObjectURL(photo))
}
onBeforeUnmount(() => setPreviews([]))

const toConfirm = (next: CardForm, reviewFields = new Set<ReviewField>()) => {
  form.value = next
  review.value = reviewFields
  step.value = 'confirm'
}

const start = async (front: Blob, back: Blob | null) => {
  setPreviews(back ? [front, back] : [front])
  step.value = 'extracting'
  progress.value = 0
  skipped = false
  extractedCount.value = null
  uploads = (async () => {
    const [frontFile, backFile] = await Promise.all([
      resizeImage(front, 'front.jpg'),
      back ? resizeImage(back, 'back.jpg') : null,
    ])
    const [frontImage, backImage] = await Promise.all([
      upload.mutateAsync(frontFile),
      backFile ? upload.mutateAsync(backFile) : null,
    ])
    return { frontImageId: frontImage.id, backImageId: backImage?.id ?? null }
  })()

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
    candidates.value = []
    await router.replace({ name: 'card', params: { id: card.id } })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <CameraCapture v-if="step === 'capture'" @done="start" @cancel="router.back()" />

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
        <img
          v-for="(url, i) in previews"
          :key="url"
          :src="url"
          :alt="i === 0 ? '表' : '裏'"
          class="thumb"
        />
      </div>
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
        :sections="['printed', 'scene']"
        :review="review"
        show-master-status
      />
    </div>
    <div class="bottom-bar">
      <v-btn
        color="primary"
        class="main-action flex-grow-1"
        :disabled="errors.length > 0"
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
</template>

<style scoped>
.thumbs {
  display: flex;
  gap: 10px;
  padding-top: 14px;
}
.thumb {
  width: 120px;
  height: 73px;
  object-fit: cover;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 4px;
}
</style>

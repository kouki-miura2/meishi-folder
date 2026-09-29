<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import CardPhoto from '../components/CardPhoto.vue'
import DeleteCardDialog from '../components/DeleteCardDialog.vue'
import ImageViewer from '../components/ImageViewer.vue'
import TopicChips from '../components/TopicChips.vue'
import { useCardQuery } from '../composables/useCards.ts'

// 1h: a card, read-only. Tapping the photo opens the viewer (1j).
const props = defineProps<{ id: string }>()
const router = useRouter()

const { data: card, isPending, isError } = useCardQuery(() => props.id)

const photoIndex = ref(0)
const viewerOpen = ref(false)
const confirmDelete = ref(false)

const imageIds = computed(() =>
  [card.value?.frontImageId, card.value?.backImageId].filter((id): id is string => !!id),
)
const phone = computed(
  () => card.value?.mobile ?? card.value?.offices.find((o) => o.tel)?.tel ?? null,
)
const email = computed(() => card.value?.emails[0] ?? null)
const address = computed(() => card.value?.offices.find((o) => o.address)?.address ?? null)
const quickActions = computed(() => [
  {
    icon: 'mdi-phone-outline',
    label: '電話',
    href: phone.value && `tel:${phone.value.replace(/[^\d+]/g, '')}`,
  },
  { icon: 'mdi-email-outline', label: 'メール', href: email.value && `mailto:${email.value}` },
  {
    icon: 'mdi-map-marker-outline',
    label: '地図',
    href:
      address.value &&
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.value)}`,
  },
])
const visibilityLabel = { private: '個人', company: '会社', department: '部署' } as const
</script>

<template>
  <div class="top-bar border-0">
    <v-btn icon="mdi-chevron-left" variant="text" aria-label="一覧へ戻る" @click="router.back()" />
    <div class="d-flex ga-1 align-center">
      <v-btn
        variant="outlined"
        rounded="pill"
        size="small"
        :to="{ name: 'card-edit', params: { id } }"
      >
        編集
      </v-btn>
      <v-menu location="bottom end">
        <template #activator="{ props: activator }">
          <v-btn v-bind="activator" icon="mdi-dots-horizontal" variant="text" aria-label="その他" />
        </template>
        <v-list density="comfortable">
          <v-list-item
            prepend-icon="mdi-delete-outline"
            title="この名刺を削除"
            base-color="error"
            @click="confirmDelete = true"
          />
        </v-list>
      </v-menu>
    </div>
  </div>

  <div v-if="isPending" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="secondary" />
  </div>
  <div v-else-if="isError || !card" class="page muted text-center">名刺を表示できませんでした</div>
  <div v-else class="detail">
    <div class="photos">
      <v-window v-if="imageIds.length" v-model="photoIndex" class="photos__window">
        <v-window-item v-for="(imageId, i) in imageIds" :key="imageId">
          <button type="button" class="photo" @click="viewerOpen = true">
            <CardPhoto :image-id="imageId" :label="i === 0 ? '表' : '裏'" />
            <span class="photo__hint">⤢ タップで拡大</span>
          </button>
        </v-window-item>
      </v-window>
      <div v-else class="photo photo--empty faint">写真なし</div>
      <div v-if="imageIds.length > 1" class="dots">
        <span v-for="(_, i) in imageIds" :key="i" :class="{ active: i === photoIndex }" />
      </div>
    </div>

    <div class="px-5 pt-3">
      <h1 class="detail__name">{{ card.name ?? card.handleName ?? card.nameKana }}</h1>
      <div class="muted text-caption">
        {{ [card.nameKana, card.nameRomaji].filter(Boolean).join(' ・ ') }}
      </div>
      <div v-if="card.company" class="mt-2">
        {{ card.company.name }}<br />
        <span class="muted text-body-2">
          {{
            [card.departments.map((d) => d.name).join(' / '), card.titles.join('・')]
              .filter(Boolean)
              .join(' ・ ')
          }}
        </span>
      </div>
      <TopicChips
        class="mt-3"
        size="small"
        :projects="card.projects.map((p) => p.name)"
        :groups="card.groups.map((g) => g.name)"
      />
    </div>

    <div class="quick">
      <v-btn
        v-for="action in quickActions"
        :key="action.label"
        :href="action.href ?? undefined"
        :disabled="!action.href"
        :target="action.label === '地図' ? '_blank' : undefined"
        variant="outlined"
        class="quick__btn"
        stacked
        :prepend-icon="action.icon"
      >
        {{ action.label }}
      </v-btn>
    </div>

    <div class="px-5 pb-8">
      <div class="section-title">連絡先</div>
      <div class="panel">
        <div v-if="card.mobile" class="panel-row">
          <span class="row-label">携帯</span><span class="mono">{{ card.mobile }}</span>
        </div>
        <div v-for="e in card.emails" :key="e" class="panel-row">
          <span class="row-label">メール</span><span class="mono text-break">{{ e }}</span>
        </div>
        <div v-if="card.url" class="panel-row">
          <span class="row-label">URL</span><span class="mono text-break">{{ card.url }}</span>
        </div>
        <div v-for="c in card.otherContacts" :key="c" class="panel-row">
          <span class="row-label">その他</span>{{ c }}
        </div>
        <div v-for="(o, i) in card.offices" :key="i" class="panel-row align-start py-3">
          <span class="row-label">事業所</span>
          <span class="text-body-2">
            <template v-if="o.postalCode">〒{{ o.postalCode }}&nbsp;</template>{{ o.address }}
            <span v-if="o.tel" class="d-block mono">TEL {{ o.tel }}</span>
            <span v-if="o.fax" class="d-block mono">FAX {{ o.fax }}</span>
          </span>
        </div>
        <div
          v-if="
            !card.mobile &&
            !card.emails.length &&
            !card.url &&
            !card.otherContacts.length &&
            !card.offices.length
          "
          class="panel-row faint"
        >
          未登録
        </div>
      </div>

      <div class="section-title">場面</div>
      <div class="panel">
        <div class="panel-row">
          <span class="row-label">取得日</span><span class="mono">{{ card.metOn ?? '—' }}</span>
        </div>
        <div class="panel-row"><span class="row-label">場所</span>{{ card.metAt ?? '—' }}</div>
        <div class="panel-row">
          <span class="row-label">機会</span>{{ card.metOccasion ?? '—' }}
        </div>
      </div>
      <div v-if="card.handleName" class="section-title">ハンドルネーム</div>
      <div v-if="card.handleName" class="panel">
        <div class="panel-row">{{ card.handleName }}</div>
      </div>

      <div class="d-flex align-center ga-2 mt-3 muted text-caption">
        <v-chip color="primary" variant="flat" size="small" prepend-icon="mdi-lock-outline">
          {{ visibilityLabel[card.visibility] }}
        </v-chip>
        公開範囲
      </div>
    </div>
  </div>

  <ImageViewer
    v-if="viewerOpen"
    :image-ids="imageIds"
    :start="photoIndex"
    @close="viewerOpen = false"
  />

  <DeleteCardDialog v-model="confirmDelete" :card-id="id" />
</template>

<style scoped>
.photos {
  padding: 4px 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.photos__window {
  width: 100%;
}
.photo {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 91 / 55;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
}
.photo--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px dashed #d8d3c8;
  box-shadow: none;
}
.photo__hint {
  position: absolute;
  right: 10px;
  bottom: 10px;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  background: rgba(27, 26, 23, 0.75);
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
}
.dots {
  display: flex;
  gap: 6px;
}
.dots span {
  width: 6px;
  height: 6px;
  border-radius: 3px;
  background: #c9c4b8;
}
.dots span.active {
  width: 18px;
  background: #1b1a17;
}
.detail__name {
  font-size: 26px;
  font-weight: 900;
}
.quick {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 14px 20px 0;
}
.quick__btn {
  height: 56px !important;
  background: #fff;
  border-color: var(--line);
  font-size: 12px;
}
</style>

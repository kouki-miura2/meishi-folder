<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCardsQuery } from '../composables/useCards.ts'
import { useTopicsQuery } from '../composables/useMasters.ts'
import { type CardFilter, emptyCardFilter, toggleTopic } from '../domain/card-filter.ts'

// 1c: the filter bottom sheet. It edits a draft and shows how many cards the draft matches;
// the list only changes on "N件を表示". Mount it only while open (it runs its own count query).
const props = defineProps<{ filter: CardFilter }>()
const emit = defineEmits<{ apply: [filter: CardFilter]; close: [] }>()

const draft = ref<CardFilter>({ ...props.filter, topicIds: [...props.filter.topicIds] })
const { data: topics } = useTopicsQuery()
const { data: matching, isFetching } = useCardsQuery(draft)

const projects = computed(() => topics.value?.filter((t) => t.kind === 'project') ?? [])
const groups = computed(() => topics.value?.filter((t) => t.kind === 'group') ?? [])
const selectedCount = (kind: 'project' | 'group') =>
  (kind === 'project' ? projects : groups).value.filter((t) => draft.value.topicIds.includes(t.id))
    .length
</script>

<template>
  <v-bottom-sheet :model-value="true" @update:model-value="emit('close')">
    <div class="sheet">
      <div class="d-flex justify-space-between align-center">
        <span class="sheet__title">絞り込み</span>
        <v-btn variant="text" class="muted" @click="draft = emptyCardFilter()">クリア</v-btn>
      </div>

      <div>
        <div class="section-title mt-0">テキスト（全項目）</div>
        <v-text-field v-model="draft.q" prepend-inner-icon="mdi-magnify" clearable />
        <div class="faint text-caption mt-1">
          氏名・会社・住所・取得場所・ハンドルネーム等すべてを対象
        </div>
      </div>

      <div>
        <div class="section-title mt-0 d-flex justify-space-between">
          <span>関連プロジェクト</span>
          <span v-if="selectedCount('project')" class="text-project">
            {{ selectedCount('project') }}件選択
          </span>
        </div>
        <div class="chips">
          <v-chip
            v-for="t in projects"
            :key="t.id"
            color="project"
            :variant="draft.topicIds.includes(t.id) ? 'flat' : 'outlined'"
            :prepend-icon="draft.topicIds.includes(t.id) ? 'mdi-check' : undefined"
            @click="draft = toggleTopic(draft, t.id)"
          >
            {{ t.name }}
          </v-chip>
          <span v-if="!projects.length" class="faint text-caption">まだありません</span>
        </div>
      </div>

      <div>
        <div class="section-title mt-0 d-flex justify-space-between">
          <span>関連グループ</span>
          <span v-if="selectedCount('group')" class="text-group">
            {{ selectedCount('group') }}件選択
          </span>
        </div>
        <div class="chips">
          <v-chip
            v-for="t in groups"
            :key="t.id"
            color="group"
            :variant="draft.topicIds.includes(t.id) ? 'flat' : 'outlined'"
            :prepend-icon="draft.topicIds.includes(t.id) ? 'mdi-check' : undefined"
            @click="draft = toggleTopic(draft, t.id)"
          >
            {{ t.name }}
          </v-chip>
          <span v-if="!groups.length" class="faint text-caption">まだありません</span>
        </div>
      </div>

      <div class="match">
        <span>複数選択時の条件</span>
        <v-btn-toggle v-model="draft.match" mandatory density="compact" color="primary">
          <v-btn value="any" size="small">いずれか</v-btn>
          <v-btn value="all" size="small">すべて</v-btn>
        </v-btn-toggle>
      </div>

      <v-btn
        color="primary"
        class="main-action"
        block
        :loading="isFetching"
        @click="emit('apply', draft)"
      >
        <span class="mono mr-1">{{ matching?.length ?? 0 }}</span
        >件を表示
      </v-btn>
    </div>
  </v-bottom-sheet>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.match {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--line-soft);
  font-size: 12px;
  color: var(--muted);
}
</style>

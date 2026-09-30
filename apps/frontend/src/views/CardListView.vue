<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import type { CardSummary } from '../api/types.ts'
import AccountMenu from '../components/AccountMenu.vue'
import FilterSheet from '../components/FilterSheet.vue'
import TopicChips from '../components/TopicChips.vue'
import { useCardsQuery } from '../composables/useCards.ts'
import { useTopicsQuery } from '../composables/useMasters.ts'
import {
  type CardFilter,
  filterFromQuery,
  filterToRouteQuery,
  toggleTopic,
} from '../domain/card-filter.ts'
import { groupByIndex, sortByCompany } from '../domain/kana-index.ts'

// 1b: the card list, in reading order under a kana index, with search and topic filters.
const route = useRoute()
const router = useRouter()

const filter = computed(() => filterFromQuery(route.query))
const setFilter = (next: CardFilter) => router.replace({ query: filterToRouteQuery(next) })

const { data: cards, isPending } = useCardsQuery(filter)
const { data: topics } = useTopicsQuery()
const byCompany = computed(() => filter.value.sort === 'company')
// Company order has no kana headings: one untitled section, and no index rail.
const indexSections = computed(() => (byCompany.value ? [] : groupByIndex(cards.value ?? [])))
const sections = computed(() =>
  byCompany.value
    ? [{ label: null, cards: sortByCompany(cards.value ?? []) }].filter((s) => s.cards.length)
    : indexSections.value,
)
const activeTopics = computed(
  () => topics.value?.filter((t) => filter.value.topicIds.includes(t.id)) ?? [],
)

// Typing searches after a short pause rather than on every keystroke.
const search = ref(filter.value.q)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => setFilter({ ...filter.value, q: q ?? '' }), LIMITS.searchDebounceMs)
})
watch(
  () => filter.value.q,
  (q) => {
    if (q !== (search.value ?? '')) search.value = q
  },
)
onScopeDispose(() => clearTimeout(timer))

const filterOpen = ref(false)
const applyFilter = (next: CardFilter) => {
  filterOpen.value = false
  void setFilter(next)
}

const title = (card: CardSummary) => card.name ?? card.handleName ?? card.nameKana ?? ''
const subtitle = (card: CardSummary) =>
  card.name ? (card.nameKana ?? '') : card.handleName ? 'ハンドルネーム' : ''
const departments = (card: CardSummary) => card.departmentNames.join(' / ')

// Only the list scrolls, so the router's scrollBehavior (window scroll) can't bring it back when
// returning from a card. Its position is kept per history entry instead: vue-router numbers each
// entry (`history.state.position`), and the one this list was opened in is read before leaving,
// since on a back navigation `history.state` already belongs to the destination.
const listEl = ref<HTMLElement>()
const entry = (history.state as { position?: number } | null)?.position
onBeforeRouteLeave(() => {
  if (entry !== undefined && listEl.value) savedScrollTops.set(entry, listEl.value.scrollTop)
})
const savedTop = entry === undefined ? undefined : savedScrollTops.get(entry)
let restored = !savedTop
watch(
  [isPending, listEl],
  async ([pending, el]) => {
    if (restored || pending || !el) return
    restored = true
    await nextTick()
    el.scrollTop = savedTop ?? 0
  },
  { immediate: true },
)

const scrollTo = (label: string) =>
  document.getElementById(`index-${label}`)?.scrollIntoView({ behavior: 'smooth' })
</script>

<script lang="ts">
/** List scroll position by history entry; see `listEl` above. */
const savedScrollTops = new Map<number, number>()
</script>

<template>
  <div class="list-view">
    <div class="list-header">
      <div>
        <h1 class="page-title">名刺</h1>
        <div class="mono muted count">{{ cards?.length ?? 0 }} cards</div>
      </div>
      <AccountMenu />
    </div>

    <div class="search">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        placeholder="名前・会社・メモを検索"
        clearable
        density="compact"
        class="flex-grow-1"
      />
      <v-badge
        :model-value="filter.topicIds.length > 0"
        :content="filter.topicIds.length"
        color="project"
      >
        <v-btn
          color="primary"
          icon="mdi-filter-variant"
          size="44"
          rounded="lg"
          aria-label="絞り込み"
          @click="filterOpen = true"
        />
      </v-badge>
    </div>

    <div v-if="activeTopics.length" class="active-filters">
      <span class="muted text-caption">絞り込み中</span>
      <v-chip
        v-for="t in activeTopics"
        :key="t.id"
        :color="t.kind === 'project' ? 'project' : 'group'"
        variant="flat"
        size="small"
        closable
        @click:close="setFilter(toggleTopic(filter, t.id))"
      >
        {{ t.name }}
      </v-chip>
    </div>

    <div class="list-area">
      <div ref="listEl" class="list">
        <div v-if="isPending" class="d-flex justify-center pa-8">
          <v-progress-circular indeterminate color="secondary" />
        </div>
        <div v-else-if="!sections.length" class="empty muted">
          <template v-if="filter.q || filter.topicIds.length">条件に合う名刺はありません</template>
          <template v-else>まだ名刺がありません。<br />右下のボタンから登録しましょう。</template>
        </div>

        <section
          v-for="section in sections"
          :id="section.label ? `index-${section.label}` : undefined"
          :key="section.label ?? 'company'"
        >
          <div v-if="section.label" class="index-heading">{{ section.label }}<span /></div>
          <router-link
            v-for="card in section.cards"
            :key="card.id"
            :to="{ name: 'card', params: { id: card.id } }"
            class="row"
            :class="{ 'row--by-company': byCompany }"
          >
            <div class="mini-card" aria-hidden="true">
              <span class="mini-card__name" />
              <span class="mini-card__line" />
              <span class="flex-grow-1" />
              <span class="mini-card__line mini-card__line--long" />
            </div>
            <div class="row__body">
              <div class="row__affiliation">
                <span class="row__company">{{ card.companyName }}</span
                ><template v-if="card.companyName && departments(card)"> ／ </template
                >{{ departments(card) }}
              </div>
              <div class="row__name">
                <span class="row__title">{{ title(card) }}</span>
                <span class="row__kana">{{ subtitle(card) }}</span>
              </div>
              <TopicChips
                class="mt-1"
                :projects="card.projects.map((p) => p.name)"
                :groups="card.groups.map((g) => g.name)"
              />
            </div>
          </router-link>
        </section>
      </div>

      <nav v-if="indexSections.length > 1" class="index-rail" aria-label="索引">
        <button
          v-for="section in indexSections"
          :key="section.label"
          type="button"
          @click="scrollTo(section.label)"
        >
          {{ section.label }}
        </button>
      </nav>

      <div class="fab-area">
        <v-btn
          color="primary"
          rounded="pill"
          class="fab"
          prepend-icon="mdi-camera-outline"
          :to="{ name: 'card-new' }"
        >
          名刺を登録
        </v-btn>
      </div>
    </div>

    <FilterSheet
      v-if="filterOpen"
      :filter="filter"
      @apply="applyFilter"
      @close="filterOpen = false"
    />
  </div>
</template>

<style scoped>
/* One screen tall: the header, search and filters stay put and only the list scrolls. */
.list-view {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.list-view > :not(.list-area) {
  flex: none;
}
.list-area {
  position: relative;
  flex: 1;
  min-height: 0;
}
.list-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 16px 20px 12px;
}
.list-header .page-title {
  font-size: 20px;
  line-height: 1.3;
}
.count {
  font-size: 12px;
  line-height: 1.4;
}
.search {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 20px 10px;
}
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding: 0 20px 8px;
}
.list {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 18px;
  /* The last row can scroll clear of the floating register button. */
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}
.empty {
  padding: 48px 20px;
  text-align: center;
  line-height: 1.8;
}
.index-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}
.index-heading span {
  flex: 1;
  height: 1px;
  background: var(--line);
}
.row {
  display: flex;
  gap: 12px;
  padding: 10px 20px;
  align-items: flex-start;
  color: inherit;
  text-decoration: none;
}
.row:active {
  background: var(--line-soft);
}
.mini-card {
  flex: none;
  width: 64px;
  height: 40px;
  margin-top: 3px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px 6px;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.mini-card__name {
  width: 60%;
  height: 3px;
  background: #1b1a17;
  border-radius: 1px;
}
.mini-card__line {
  width: 40%;
  height: 2px;
  background: #c9c4b8;
}
.mini-card__line--long {
  width: 75%;
}
.row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row__affiliation {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row__name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.row__title {
  font-size: 17px;
  font-weight: 700;
}
/* In company order the company leads the row and the name steps back. */
.row--by-company .row__company {
  font-weight: 700;
  color: #1b1a17;
}
.row--by-company .row__title {
  font-weight: 400;
}
/* Same size as the affiliation line; the row aligns it to the name on the baseline. */
.row__kana {
  font-size: 11px;
  color: var(--muted);
}
.index-rail {
  position: absolute;
  top: 10px;
  right: 2px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.index-rail button {
  font-size: 10px;
  font-weight: 700;
  color: var(--faint);
  padding: 1px 4px;
}
.fab-area {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: 0 20px calc(24px + env(safe-area-inset-bottom));
  pointer-events: none;
}
.fab {
  pointer-events: auto;
  height: 40px !important;
  box-shadow: 0 8px 20px rgba(27, 26, 23, 0.35);
}
/* Noto Sans JP sits a little below the line box's center, so the icon moves down to meet it. */
.fab :deep(.v-btn__prepend) {
  transform: translateY(1px);
}
</style>

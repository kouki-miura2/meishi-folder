<script setup lang="ts">
import { ref } from 'vue'

import type { CardSummary } from '../api/types.ts'

export type CandidateChoice = { mode: 'overwrite'; cardId: string } | { mode: 'new' }

// 1g: a registered card has the same name. The same name may be someone else, so the user
// decides: overwrite that card (photos and printed items only) or register a new one.
const props = defineProps<{
  candidates: CardSummary[]
  current: { name: string; companyName: string; titles: string[]; metOn: string }
  saving: boolean
}>()
const emit = defineEmits<{ choose: [choice: CandidateChoice]; close: [] }>()

const selected = ref<string>(props.candidates[0]?.id ?? 'new')

const confirm = () =>
  emit(
    'choose',
    selected.value === 'new' ? { mode: 'new' } : { mode: 'overwrite', cardId: selected.value },
  )
</script>

<template>
  <v-bottom-sheet :model-value="true" @update:model-value="emit('close')">
    <div class="sheet">
      <div>
        <div class="sheet__title">同じ氏名の名刺があります</div>
        <div class="muted text-body-2 mt-1">
          同姓同名の別人の可能性もあります。候補を確認して選んでください。
        </div>
      </div>

      <div class="compare">
        <div class="compare__card compare__card--current">
          <span class="muted font-weight-bold">今回</span>
          <span class="compare__name">{{ current.name }}</span>
          <span>{{ current.companyName }}</span>
          <span class="muted">{{ current.titles.join('・') }}</span>
          <span class="mono faint">{{ current.metOn }}</span>
        </div>
      </div>

      <div class="d-flex flex-column ga-2">
        <button
          v-for="c in candidates"
          :key="c.id"
          type="button"
          class="choice"
          :class="{ 'choice--selected': selected === c.id }"
          @click="selected = c.id"
        >
          <span class="choice__mark" />
          <div>
            <div class="font-weight-bold">登録済みの名刺を上書き</div>
            <div class="text-body-2 mt-1">
              {{ c.name
              }}<span class="muted">
                ・
                {{
                  [c.companyName, ...c.departmentNames].filter(Boolean).join(' ') || '所属なし'
                }}</span
              >
            </div>
            <div class="muted text-caption mt-1">
              名刺写真・記載項目を更新。<b class="text-primary">場面・補足事項はそのまま保持</b
              >します。
            </div>
          </div>
        </button>
        <button
          type="button"
          class="choice"
          :class="{ 'choice--selected': selected === 'new' }"
          @click="selected = 'new'"
        >
          <span class="choice__mark" />
          <div>
            <div class="font-weight-bold">別の名刺として新規登録</div>
            <div class="muted text-caption mt-1">別人、または別々に残したい場合</div>
          </div>
        </button>
      </div>

      <v-btn color="primary" class="main-action" block :loading="saving" @click="confirm">
        {{ selected === 'new' ? '新規登録して保存' : '上書きして保存' }}
      </v-btn>
    </div>
  </v-bottom-sheet>
</template>

<style scoped>
.compare__card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  font-size: 11px;
}
.compare__card--current {
  border: 1.5px solid #1b1a17;
}
.compare__name {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
}
</style>

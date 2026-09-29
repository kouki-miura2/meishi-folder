<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { ApiError } from '../api/client.ts'
import { errorMessage } from '../api/errors.ts'
import { findVariantGroups } from '../domain/master-names.ts'
import { useNotificationStore } from '../stores/notification.ts'
import MergeSheet, { type MergeItem, type MergeRequest } from './MergeSheet.vue'
import NameDialog from './NameDialog.vue'

export interface MasterActions {
  rename: (id: string, name: string) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
  merge: (targetId: string, sourceIds: string[]) => Promise<unknown>
}

// The list shared by company settings (1k) and department settings (1m): counts, spelling-variant
// hints, rename, and a select mode for deleting and merging (1l).
const props = defineProps<{
  items: MergeItem[]
  kindLabel: string
  actions: MasterActions
  /** Where tapping a row leads when not selecting (companies → their departments). */
  rowTo?: (item: MergeItem) => RouteLocationRaw
}>()

const notification = useNotificationStore()
const selecting = defineModel<boolean>('selecting', { default: false })
const selected = ref<string[]>([])
const renaming = ref<MergeItem | null>(null)
const merging = ref<MergeItem[] | null>(null)
const busy = ref(false)

const variantGroups = computed(() => findVariantGroups(props.items))
const variantIds = computed(() => new Set(variantGroups.value.flat().map((i) => i.id)))

const toggle = (id: string) => {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((s) => s !== id)
    : [...selected.value, id]
}
const finish = () => {
  selected.value = []
  selecting.value = false
}

const run = async (task: () => Promise<unknown>) => {
  busy.value = true
  try {
    await task()
    return true
  } catch {
    return false
  } finally {
    busy.value = false
  }
}

const rename = async (name: string) => {
  const target = renaming.value
  if (target && (await run(() => props.actions.rename(target.id, name)))) renaming.value = null
}

const removeSelected = async () => {
  const blocked: string[] = []
  busy.value = true
  for (const item of props.items.filter((i) => selected.value.includes(i.id))) {
    try {
      await props.actions.remove(item.id)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) blocked.push(item.name)
      else notification.show(errorMessage(error))
    }
  }
  busy.value = false
  if (blocked.length) {
    notification.show(
      `「${blocked.join('」「')}」は名刺や所属で使われているため削除できません。統合してください`,
    )
  }
  finish()
}

const merge = async ({ targetId, newName }: MergeRequest) => {
  const group = merging.value ?? []
  const sourceIds = group.map((i) => i.id).filter((id) => id !== targetId)
  const done = await run(async () => {
    if (newName) await props.actions.rename(targetId, newName)
    await props.actions.merge(targetId, sourceIds)
  })
  if (done) {
    merging.value = null
    finish()
  }
}
</script>

<template>
  <div v-if="variantGroups.length && !selecting" class="caution-note variant-hint">
    <span class="flex-grow-1">似た名称の{{ kindLabel }}が{{ variantIds.size }}件あります</span>
    <v-btn size="small" color="caution" variant="flat" @click="merging = variantGroups[0] ?? null">
      統合する
    </v-btn>
  </div>

  <div v-if="items.length" class="panel">
    <div v-for="item in items" :key="item.id" class="panel-row master-row">
      <v-checkbox-btn
        v-if="selecting"
        :model-value="selected.includes(item.id)"
        :aria-label="`${item.name}を選択`"
        @update:model-value="toggle(item.id)"
      />
      <component
        :is="!selecting && rowTo ? 'router-link' : 'div'"
        :to="!selecting && rowTo ? rowTo(item) : undefined"
        class="master-row__body"
        @click="selecting && toggle(item.id)"
      >
        <div class="master-row__name">{{ item.name }}</div>
        <div class="muted text-caption">
          名刺 {{ item.cardCount }}枚<template v-if="item.departmentCount !== undefined">
            ・ 部署 {{ item.departmentCount }}件</template
          >
        </div>
      </component>
      <v-chip v-if="variantIds.has(item.id)" color="caution" size="x-small">表記ゆれ?</v-chip>
      <v-btn
        v-if="!selecting"
        icon="mdi-pencil-outline"
        variant="text"
        size="small"
        :aria-label="`${item.name}の名称を変更`"
        @click="renaming = item"
      />
    </div>
  </div>
  <div v-else class="muted text-center pa-6">まだありません</div>

  <div v-if="selecting" class="bottom-bar editor-actions">
    <v-btn
      variant="outlined"
      color="error"
      class="main-action"
      width="110"
      :disabled="!selected.length"
      :loading="busy"
      @click="removeSelected"
    >
      削除
    </v-btn>
    <v-btn
      color="primary"
      class="main-action flex-grow-1"
      :disabled="selected.length < 2"
      @click="merging = items.filter((i) => selected.includes(i.id))"
    >
      {{ selected.length }}件を統合
    </v-btn>
  </div>

  <NameDialog
    v-if="renaming"
    :title="`${kindLabel}の名称を変更`"
    :initial="renaming.name"
    :saving="busy"
    @save="rename"
    @close="renaming = null"
  />
  <MergeSheet
    v-if="merging"
    :items="merging"
    :kind-label="kindLabel"
    :saving="busy"
    @merge="merge"
    @close="merging = null"
  />
</template>

<style scoped>
.variant-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.master-row {
  min-height: 60px;
}
.master-row :deep(.v-selection-control) {
  flex: none;
}
.master-row__body {
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.master-row__name {
  font-size: 15px;
  font-weight: 700;
}
.editor-actions {
  margin: 16px -20px -24px;
}
</style>

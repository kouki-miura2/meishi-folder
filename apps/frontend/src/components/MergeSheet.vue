<script setup lang="ts">
import { computed, ref } from 'vue'

export interface MergeItem {
  id: string
  name: string
  cardCount: number
  departmentCount?: number
}
export interface MergeRequest {
  targetId: string
  /** Rename the kept master to this before merging ("別の名称を入力…"). */
  newName: string | null
}

// 1l: merging spelling variants. The user picks the name to keep (or types a new one); the
// others are folded into it.
const props = defineProps<{ items: MergeItem[]; kindLabel: string; saving: boolean }>()
const emit = defineEmits<{ merge: [request: MergeRequest]; close: [] }>()

const byCards = computed(() => [...props.items].sort((a, b) => b.cardCount - a.cardCount))
const selected = ref<string>(byCards.value[0]?.id ?? '')
const customName = ref('')
const isCustom = computed(() => selected.value === 'custom')

// With a typed name, the master with the most cards is kept (and renamed).
const targetId = computed(() => (isCustom.value ? (byCards.value[0]?.id ?? '') : selected.value))
const moving = computed(() => props.items.filter((i) => i.id !== targetId.value))
const movingCards = computed(() => moving.value.reduce((sum, i) => sum + i.cardCount, 0))
const movingDepartments = computed(() =>
  moving.value.reduce((sum, i) => sum + (i.departmentCount ?? 0), 0),
)
const canMerge = computed(() => !isCustom.value || !!customName.value.trim())

const confirm = () =>
  emit('merge', {
    targetId: targetId.value,
    newName: isCustom.value ? customName.value.trim() : null,
  })
</script>

<template>
  <v-bottom-sheet :model-value="true" @update:model-value="emit('close')">
    <div class="sheet">
      <div>
        <div class="sheet__title">{{ items.length }}件の{{ kindLabel }}を統合</div>
        <div class="muted text-body-2 mt-1">残す名称を選んでください</div>
      </div>

      <div class="d-flex flex-column ga-2">
        <button
          v-for="item in byCards"
          :key="item.id"
          type="button"
          class="choice"
          :class="{ 'choice--selected': selected === item.id }"
          @click="selected = item.id"
        >
          <span class="choice__mark" />
          <span class="flex-grow-1" :class="{ 'font-weight-bold': selected === item.id }">{{
            item.name
          }}</span>
          <span class="muted text-caption">{{ item.cardCount }}枚</span>
        </button>
        <div
          class="choice choice--custom"
          :class="{ 'choice--selected': isCustom }"
          @click="selected = 'custom'"
        >
          <span class="choice__mark" />
          <v-text-field
            v-model="customName"
            placeholder="別の名称を入力…"
            variant="plain"
            density="compact"
            bg-color="transparent"
            @focus="selected = 'custom'"
          />
        </div>
      </div>

      <div class="summary">
        <div class="d-flex justify-space-between">
          <span class="muted">移動する名刺</span><b class="mono">{{ movingCards }}枚</b>
        </div>
        <div
          v-if="items.some((i) => i.departmentCount !== undefined)"
          class="d-flex justify-space-between"
        >
          <span class="muted">移動する部署</span><b class="mono">{{ movingDepartments }}件</b>
        </div>
        <div v-if="items.some((i) => i.departmentCount !== undefined)" class="summary__note">
          同名の部署はまとめて統合されます。似た名称の部署は部署設定で続けて統合できます
        </div>
      </div>

      <v-btn
        color="primary"
        class="main-action"
        block
        :disabled="!canMerge"
        :loading="saving"
        @click="confirm"
      >
        統合する
      </v-btn>
    </div>
  </v-bottom-sheet>
</template>

<style scoped>
.choice--custom {
  border-style: dashed;
  padding-top: 4px;
  padding-bottom: 4px;
}
.summary {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--line-soft);
  font-size: 12px;
  line-height: 1.8;
}
.summary__note {
  margin-top: 4px;
  color: rgb(var(--v-theme-caution));
}
</style>

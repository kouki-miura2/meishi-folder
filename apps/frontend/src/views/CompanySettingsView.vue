<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import MasterListEditor, { type MasterActions } from '../components/MasterListEditor.vue'
import NameDialog from '../components/NameDialog.vue'
import { useCompaniesQuery, useCompanyMutations } from '../composables/useMasters.ts'

// 1k: the user's companies; tap one for its departments (1m), select several to merge (1l).
const router = useRouter()
const { data: companies, isPending } = useCompaniesQuery()
const mutations = useCompanyMutations()

const selecting = ref(false)
const adding = ref(false)

const actions: MasterActions = {
  rename: (id, name) => mutations.rename.mutateAsync({ id, name }),
  remove: (id) => mutations.remove.mutateAsync(id),
  merge: (targetId, sourceIds) => mutations.merge.mutateAsync({ targetId, sourceIds }),
}
const items = computed(() => companies.value ?? [])

const add = async (name: string) => {
  await mutations.create.mutateAsync(name)
  adding.value = false
}
</script>

<template>
  <div class="top-bar border-0">
    <v-btn
      v-if="!selecting"
      variant="text"
      prepend-icon="mdi-chevron-left"
      class="px-2"
      @click="router.push({ name: 'settings' })"
    >
      設定
    </v-btn>
    <v-btn v-else variant="text" class="muted" @click="selecting = false">完了</v-btn>
    <v-btn variant="text" class="font-weight-bold" @click="selecting = !selecting">
      {{ selecting ? 'キャンセル' : '選択' }}
    </v-btn>
  </div>
  <div class="page d-flex flex-column">
    <h1 class="page-title">会社・団体</h1>
    <p class="muted text-caption mt-1 mb-4">表記ゆれのあるマスタを選択して統合できます</p>

    <div v-if="isPending" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="secondary" />
    </div>
    <MasterListEditor
      v-else
      v-model:selecting="selecting"
      :items="items"
      kind-label="会社・団体"
      :actions="actions"
      :row-to="(item) => ({ name: 'departments', params: { companyId: item.id } })"
    />
    <v-btn
      v-if="!selecting"
      variant="text"
      prepend-icon="mdi-plus"
      class="align-self-start px-1 mt-2"
      @click="adding = true"
    >
      会社・団体を追加
    </v-btn>
  </div>

  <NameDialog
    v-if="adding"
    title="会社・団体を追加"
    :saving="mutations.create.isPending.value"
    @save="add"
    @close="adding = false"
  />
</template>

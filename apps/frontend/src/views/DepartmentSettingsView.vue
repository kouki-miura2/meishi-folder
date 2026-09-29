<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import MasterListEditor, { type MasterActions } from '../components/MasterListEditor.vue'
import {
  useCompaniesQuery,
  useDepartmentMutations,
  useDepartmentsQuery,
} from '../composables/useMasters.ts'

// 1m: the departments of one company (a sub-screen of 1k).
const props = defineProps<{ companyId: string }>()
const router = useRouter()

const { data: companies } = useCompaniesQuery()
const { data: departments, isPending } = useDepartmentsQuery(() => props.companyId)
const mutations = useDepartmentMutations()

const company = computed(() => companies.value?.find((c) => c.id === props.companyId))
const selecting = ref(false)
const newName = ref('')

const actions: MasterActions = {
  rename: (id, name) => mutations.rename.mutateAsync({ id, name }),
  remove: (id) => mutations.remove.mutateAsync(id),
  merge: (targetId, sourceIds) => mutations.merge.mutateAsync({ targetId, sourceIds }),
}

const add = async () => {
  const name = newName.value.trim()
  if (!name) return
  await mutations.create.mutateAsync({ companyId: props.companyId, name })
  newName.value = ''
}
</script>

<template>
  <div class="top-bar border-0">
    <v-btn
      variant="text"
      prepend-icon="mdi-chevron-left"
      class="px-2"
      @click="router.push({ name: 'companies' })"
    >
      会社・団体
    </v-btn>
    <v-btn variant="text" class="font-weight-bold" @click="selecting = !selecting">
      {{ selecting ? 'キャンセル' : '選択' }}
    </v-btn>
  </div>
  <div class="page d-flex flex-column">
    <div class="muted text-caption">{{ company?.name }}</div>
    <h1 class="page-title mb-3">部署</h1>

    <v-text-field
      v-if="!selecting"
      v-model="newName"
      placeholder="新しい部署名"
      class="mb-3"
      @keydown.enter="add"
    >
      <template #append-inner>
        <v-btn
          color="primary"
          size="small"
          :disabled="!newName.trim()"
          :loading="mutations.create.isPending.value"
          @click="add"
        >
          追加
        </v-btn>
      </template>
    </v-text-field>

    <div v-if="isPending" class="d-flex justify-center pa-8">
      <v-progress-circular indeterminate color="secondary" />
    </div>
    <MasterListEditor
      v-else
      v-model:selecting="selecting"
      :items="departments ?? []"
      kind-label="部署"
      :actions="actions"
    />
  </div>
</template>

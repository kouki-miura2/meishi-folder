<script setup lang="ts">
import { computed } from 'vue'

import type { CompanyListItem } from '../api/types.ts'
import { useDepartmentsQuery } from '../composables/useMasters.ts'

export interface AffiliationForm {
  companyName: string
  departmentName: string
}

// One company + department pair of the user's own affiliations (welcome screen, 1a). Existing
// masters are offered; any other name creates one when saved.
const model = defineModel<AffiliationForm>({ required: true })

const props = defineProps<{ companies: CompanyListItem[] }>()
defineEmits<{ remove: [] }>()

const companyId = computed(
  () => props.companies.find((c) => c.name === model.value.companyName.trim())?.id ?? null,
)
const { data: departments } = useDepartmentsQuery(companyId)
const departmentNames = computed(() =>
  companyId.value ? (departments.value ?? []).map((d) => d.name) : [],
)
</script>

<template>
  <div class="d-flex align-center ga-1">
    <div class="d-flex flex-column ga-2 flex-grow-1">
      <v-combobox
        :model-value="model.companyName"
        :items="companies.map((c) => c.name)"
        label="会社・団体"
        @update:model-value="model = { ...model, companyName: $event ?? '' }"
      />
      <v-combobox
        :model-value="model.departmentName"
        :items="departmentNames"
        label="部署"
        @update:model-value="model = { ...model, departmentName: $event ?? '' }"
      />
    </div>
    <v-btn
      icon="mdi-close"
      variant="text"
      size="small"
      aria-label="所属を削除"
      @click="$emit('remove')"
    />
  </div>
</template>

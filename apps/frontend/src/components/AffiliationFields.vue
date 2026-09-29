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
  <div class="panel affiliation">
    <v-combobox
      :model-value="model.companyName"
      :items="companies.map((c) => c.name)"
      label="会社・団体"
      variant="plain"
      bg-color="transparent"
      @update:model-value="model = { ...model, companyName: $event ?? '' }"
    >
      <template #append>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="所属を削除"
          @click="$emit('remove')"
        />
      </template>
    </v-combobox>
    <v-divider />
    <v-combobox
      :model-value="model.departmentName"
      :items="departmentNames"
      label="部署"
      variant="plain"
      bg-color="transparent"
      @update:model-value="model = { ...model, departmentName: $event ?? '' }"
    />
  </div>
</template>

<style scoped>
.affiliation {
  padding: 0 4px 0 14px;
}
</style>

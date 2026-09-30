<script setup lang="ts">
import { computed, toRaw } from 'vue'

import {
  useCompaniesQuery,
  useDepartmentsQuery,
  useTopicsQuery,
} from '../composables/useMasters.ts'
import {
  type CardForm,
  type PrintedField,
  type ReviewField,
  changedPrintedFields,
  emptyOffice,
  printedText,
} from '../domain/card-form.ts'
import { masterStatus } from '../domain/master-names.ts'
import PrintedChange from './PrintedChange.vue'
import StringListField from './StringListField.vue'
import TopicPicker from './TopicPicker.vue'

export type CardFormSection = 'printed' | 'scene' | 'notes' | 'memo' | 'visibility'

// Every card field, grouped as the design groups them. Used by the confirm step of registration
// (1f: printed items, scene and memo) and by the edit screen (1i: everything).
const form = defineModel<CardForm>({ required: true })

const props = withDefaults(
  defineProps<{
    sections: CardFormSection[]
    /** Fields the AI may have misread ("要確認"). */
    review?: Set<ReviewField>
    /** Show whether the company / departments match an existing master or will create one. */
    showMasterStatus?: boolean
    /** The card before its printed items were overwritten: each changed item shows what it was. */
    before?: CardForm | null
  }>(),
  { review: () => new Set(), showMasterStatus: false, before: null },
)

const { data: companies } = useCompaniesQuery()
const { data: topics } = useTopicsQuery()
const companyId = computed(
  () => companies.value?.find((c) => c.name === form.value.companyName.trim())?.id ?? null,
)
const { data: departments } = useDepartmentsQuery(companyId)

const companyNames = computed(() => companies.value?.map((c) => c.name) ?? [])
const departmentNames = computed(() =>
  (companyId.value ? (departments.value ?? []) : []).map((d) => d.name),
)
const topicNames = (kind: 'project' | 'group') =>
  topics.value?.filter((t) => t.kind === kind).map((t) => t.name) ?? []

const companyStatus = computed(() => masterStatus(form.value.companyName, companies.value ?? []))
const departmentsStatus = computed(() => {
  const names = form.value.departmentNames.map((n) => n.trim()).filter(Boolean)
  if (names.length === 0) return null
  const known = companyId.value ? (departments.value ?? []) : []
  return names.every((n) => masterStatus(n, known) === 'existing') ? 'existing' : 'new'
})
const statusLabel = { existing: '既存マスタ', new: '新規作成' } as const

const set = <K extends keyof CardForm>(key: K, value: CardForm[K]) => {
  form.value = { ...form.value, [key]: value }
}
const has = (section: CardFormSection) => props.sections.includes(section)
const reviewed = (field: ReviewField) => props.review.has(field)

const changed = computed(() =>
  props.before ? changedPrintedFields(props.before, form.value) : new Set<PrintedField>(),
)
const restore = (field: PrintedField) => {
  if (props.before) set(field, structuredClone(toRaw(props.before[field])))
}
</script>

<template>
  <div class="card-form">
    <template v-if="has('printed')">
      <div class="section-title">名刺記載</div>
      <div class="fields">
        <v-text-field
          :model-value="form.name"
          label="氏名"
          @update:model-value="set('name', $event)"
        >
          <template v-if="reviewed('name')" #append-inner>
            <v-chip color="caution" size="x-small">要確認</v-chip>
          </template>
        </v-text-field>
        <PrintedChange
          v-if="changed.has('name')"
          :before="printedText(before!, 'name')"
          @restore="restore('name')"
        />
        <v-text-field
          :model-value="form.nameKana"
          label="氏名カナ"
          @update:model-value="set('nameKana', $event)"
        >
          <template v-if="reviewed('nameKana')" #append-inner>
            <v-chip color="caution" size="x-small">要確認</v-chip>
          </template>
        </v-text-field>
        <PrintedChange
          v-if="changed.has('nameKana')"
          :before="printedText(before!, 'nameKana')"
          @restore="restore('nameKana')"
        />
        <v-text-field
          :model-value="form.nameRomaji"
          label="氏名ローマ字"
          @update:model-value="set('nameRomaji', $event)"
        />
        <PrintedChange
          v-if="changed.has('nameRomaji')"
          :before="printedText(before!, 'nameRomaji')"
          @restore="restore('nameRomaji')"
        />
        <v-combobox
          :model-value="form.companyName"
          :items="companyNames"
          label="会社・団体"
          @update:model-value="set('companyName', $event ?? '')"
        >
          <template v-if="showMasterStatus && companyStatus" #append-inner>
            <v-chip size="x-small" variant="flat" color="surface-variant">
              {{ statusLabel[companyStatus] }}
            </v-chip>
          </template>
        </v-combobox>
        <PrintedChange
          v-if="changed.has('companyName')"
          :before="printedText(before!, 'companyName')"
          @restore="restore('companyName')"
        />
        <v-combobox
          :model-value="form.departmentNames"
          :items="departmentNames"
          label="部署"
          multiple
          chips
          closable-chips
          @update:model-value="set('departmentNames', $event)"
        >
          <template v-if="showMasterStatus && departmentsStatus" #append-inner>
            <v-chip size="x-small" variant="flat" color="surface-variant">
              {{ statusLabel[departmentsStatus] }}
            </v-chip>
          </template>
        </v-combobox>
        <PrintedChange
          v-if="changed.has('departmentNames')"
          :before="printedText(before!, 'departmentNames')"
          @restore="restore('departmentNames')"
        />
        <StringListField
          :model-value="form.titles"
          label="役職"
          @update:model-value="set('titles', $event)"
        />
        <PrintedChange
          v-if="changed.has('titles')"
          :before="printedText(before!, 'titles')"
          @restore="restore('titles')"
        />
        <StringListField
          :model-value="form.jobTypes"
          label="職種"
          @update:model-value="set('jobTypes', $event)"
        />
        <PrintedChange
          v-if="changed.has('jobTypes')"
          :before="printedText(before!, 'jobTypes')"
          @restore="restore('jobTypes')"
        />
        <v-text-field
          :model-value="form.mobile"
          label="携帯"
          type="tel"
          class="mono"
          @update:model-value="set('mobile', $event)"
        >
          <template v-if="reviewed('mobile')" #append-inner>
            <v-chip color="caution" size="x-small">要確認</v-chip>
          </template>
        </v-text-field>
        <PrintedChange
          v-if="changed.has('mobile')"
          :before="printedText(before!, 'mobile')"
          @restore="restore('mobile')"
        />
        <StringListField
          :model-value="form.emails"
          label="メール"
          type="email"
          mono
          :review="reviewed('emails')"
          @update:model-value="set('emails', $event)"
        />
        <PrintedChange
          v-if="changed.has('emails')"
          :before="printedText(before!, 'emails')"
          @restore="restore('emails')"
        />
        <v-text-field
          :model-value="form.url"
          label="URL"
          type="url"
          class="mono"
          @update:model-value="set('url', $event)"
        >
          <template v-if="reviewed('url')" #append-inner>
            <v-chip color="caution" size="x-small">要確認</v-chip>
          </template>
        </v-text-field>
        <PrintedChange
          v-if="changed.has('url')"
          :before="printedText(before!, 'url')"
          @restore="restore('url')"
        />
        <StringListField
          :model-value="form.otherContacts"
          label="その他連絡"
          @update:model-value="set('otherContacts', $event)"
        />
        <PrintedChange
          v-if="changed.has('otherContacts')"
          :before="printedText(before!, 'otherContacts')"
          @restore="restore('otherContacts')"
        />
      </div>

      <div class="section-title d-flex align-center">
        事業所
        <v-chip v-if="reviewed('offices')" color="caution" size="x-small" class="ml-2"
          >要確認</v-chip
        >
      </div>
      <div class="fields">
        <PrintedChange
          v-if="changed.has('offices')"
          :before="printedText(before!, 'offices')"
          class="mt-0"
          @restore="restore('offices')"
        />
        <div v-for="(office, index) in form.offices" :key="index" class="panel office">
          <div class="office__head">
            <span class="muted">事業所 {{ index + 1 }}</span>
            <v-btn
              icon="mdi-minus"
              variant="text"
              size="small"
              aria-label="事業所を削除"
              @click="
                set(
                  'offices',
                  form.offices.filter((_, i) => i !== index),
                )
              "
            />
          </div>
          <v-text-field
            v-for="field in ['postalCode', 'address', 'tel', 'fax'] as const"
            :key="field"
            :model-value="office[field]"
            :label="{ postalCode: '郵便番号', address: '住所', tel: '電話', fax: 'FAX' }[field]"
            :class="{ mono: field !== 'address' }"
            @update:model-value="
              set(
                'offices',
                form.offices.map((o, i) => (i === index ? { ...o, [field]: $event } : o)),
              )
            "
          />
        </div>
        <v-btn
          variant="text"
          class="px-1 align-self-start"
          prepend-icon="mdi-plus"
          @click="set('offices', [...form.offices, emptyOffice()])"
        >
          事業所を追加
        </v-btn>
      </div>
    </template>

    <template v-if="has('scene')">
      <div class="section-title">場面</div>
      <div class="fields">
        <v-text-field
          :model-value="form.metOn"
          label="取得日"
          type="date"
          class="mono"
          @update:model-value="set('metOn', $event)"
        />
        <v-text-field
          :model-value="form.metAt"
          label="取得場所"
          placeholder="例：東京ビッグサイト"
          @update:model-value="set('metAt', $event)"
        />
        <v-text-field
          :model-value="form.metOccasion"
          label="取得機会"
          placeholder="例：展示会、商談"
          @update:model-value="set('metOccasion', $event)"
        />
      </div>
    </template>

    <template v-if="has('notes')">
      <div class="section-title">補足事項</div>
      <div class="panel notes">
        <div class="notes__label">関連プロジェクト</div>
        <TopicPicker
          :model-value="form.projectNames"
          kind="project"
          :options="topicNames('project')"
          @update:model-value="set('projectNames', $event)"
        />
        <v-divider />
        <div class="notes__label">関連グループ</div>
        <TopicPicker
          :model-value="form.groupNames"
          kind="group"
          :options="topicNames('group')"
          @update:model-value="set('groupNames', $event)"
        />
        <v-divider />
        <v-text-field
          :model-value="form.handleName"
          label="ハンドルネーム"
          @update:model-value="set('handleName', $event)"
        />
      </div>
    </template>

    <template v-if="has('memo')">
      <div class="section-title">メモ</div>
      <v-textarea
        :model-value="form.memo"
        placeholder="自由に記入できます"
        auto-grow
        rows="3"
        :maxlength="1000"
        counter
        @update:model-value="set('memo', $event)"
      />
    </template>

    <template v-if="has('visibility')">
      <div class="section-title">公開範囲</div>
      <v-btn-toggle
        :model-value="form.visibility"
        mandatory
        variant="outlined"
        divided
        color="primary"
        class="visibility"
        @update:model-value="set('visibility', $event)"
      >
        <v-btn value="private">個人</v-btn>
        <v-btn value="company" disabled>会社</v-btn>
        <v-btn value="department" disabled>部署</v-btn>
      </v-btn-toggle>
      <div class="faint mt-2 text-caption">
        「会社」「部署」は相互認証した組織と共有されます（今後対応）
      </div>
    </template>
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.office {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px 12px;
}
.office__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}
.notes {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}
.notes__label {
  font-size: 11px;
  color: var(--muted);
}
.visibility {
  width: 100%;
}
.visibility .v-btn {
  flex: 1;
}
</style>

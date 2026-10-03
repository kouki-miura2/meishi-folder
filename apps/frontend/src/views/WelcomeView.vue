<script setup lang="ts">
import { TERMS_VERSION } from 'utils'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AffiliationFields, { type AffiliationForm } from '../components/AffiliationFields.vue'
import AppLogo from '../components/AppLogo.vue'
import LegalDocument from '../components/LegalDocument.vue'
import { useCompaniesQuery } from '../composables/useMasters.ts'
import { useMeQuery, useSaveMeMutation } from '../composables/useMe.ts'
import type { LegalDocumentKind } from '../legal/documents.ts'
import { useAuthStore } from '../stores/auth.ts'

// 1a: the first-time profile, and later the place to change it (from the settings screen).
const auth = useAuthStore()
const router = useRouter()
const { data: me } = useMeQuery()
const { data: companies } = useCompaniesQuery()
const save = useSaveMeMutation()

// The first time, the Google account's name is a good first guess.
const name = ref(auth.profile?.name ?? '')
const nameKana = ref('')
const affiliations = ref<AffiliationForm[]>([{ companyName: '', departmentName: '' }])

// Editing an existing profile: start from what is saved.
watch(
  me,
  (profile) => {
    if (!profile) return
    name.value = profile.name
    nameKana.value = profile.nameKana ?? ''
    affiliations.value = profile.affiliations.map((a) => ({
      companyName: a.company.name,
      departmentName: a.department?.name ?? '',
    }))
  },
  { immediate: true },
)

const isFirstTime = computed(() => me.value === null)
// Registering needs the terms agreed to; the API refuses it otherwise.
const agreed = ref(false)
// The terms open over this screen, not in place of it, so what was typed stays.
const reading = ref<LegalDocumentKind | null>(null)
const canSave = computed(() => !!name.value.trim() && (!isFirstTime.value || agreed.value))

const submit = async () => {
  // Saving fills the profile cache, so read this first.
  const next = isFirstTime.value ? 'cards' : 'settings'
  await save.mutateAsync({
    name: name.value,
    nameKana: nameKana.value || null,
    affiliations: affiliations.value
      .filter((a) => a.companyName.trim())
      .map((a) => ({ companyName: a.companyName, departmentName: a.departmentName || null })),
    ...(isFirstTime.value && { agreedTermsVersion: TERMS_VERSION }),
  })
  await router.replace({ name: next })
}
</script>

<template>
  <div v-if="!isFirstTime" class="top-bar">
    <v-btn icon="mdi-chevron-left" variant="text" aria-label="戻る" @click="router.back()" />
    <span class="top-bar__title">プロフィール</span>
    <span style="width: 44px" />
  </div>
  <div class="page welcome">
    <template v-if="isFirstTime">
      <AppLogo />
      <div>
        <h1 class="welcome__title">ようこそ、<br />Meishi-folderへ</h1>
        <p class="muted welcome__lead">
          あなた自身の情報を登録してください。<br />所属はあとから変更できます。
        </p>
      </div>
    </template>

    <div class="panel account">
      <v-avatar size="32" color="#D9D4C7">
        <v-img v-if="auth.profile?.picture" :src="auth.profile.picture" alt="" />
        <span v-else class="font-weight-bold">{{ (auth.profile?.name ?? '?').charAt(0) }}</span>
      </v-avatar>
      <div class="account__text">
        <div class="font-weight-bold">Googleでログイン中</div>
        <div class="muted mono">{{ auth.profile?.email }}</div>
      </div>
    </div>

    <v-text-field v-model="name" label="氏名" autocomplete="name" />
    <v-text-field v-model="nameKana" label="氏名カナ" />

    <div>
      <div class="section-title mt-0">所属</div>
      <div class="d-flex flex-column ga-4">
        <AffiliationFields
          v-for="(_, index) in affiliations"
          :key="index"
          v-model="affiliations[index]!"
          :companies="companies ?? []"
          @remove="affiliations = affiliations.filter((_, i) => i !== index)"
        />
      </div>
      <v-btn
        variant="text"
        class="px-1 mt-1"
        prepend-icon="mdi-plus"
        @click="affiliations = [...affiliations, { companyName: '', departmentName: '' }]"
      >
        所属を追加
      </v-btn>
    </div>
  </div>
  <div class="bottom-bar flex-column">
    <v-checkbox v-if="isFirstTime" v-model="agreed" hide-details density="compact" class="terms">
      <template #label>
        <span>
          <a href="/terms" @click.stop.prevent="reading = 'terms'">利用規約</a>と<a
            href="/privacy"
            @click.stop.prevent="reading = 'privacy'"
            >プライバシーポリシー</a
          >に同意する
        </span>
      </template>
    </v-checkbox>
    <v-btn
      color="primary"
      class="main-action"
      block
      :disabled="!canSave"
      :loading="save.isPending.value"
      @click="submit"
    >
      {{ isFirstTime ? 'はじめる' : '保存する' }}
    </v-btn>
    <div class="text-center faint text-caption">登録データはあなただけが参照できます</div>
  </div>

  <v-dialog :model-value="!!reading" fullscreen scrollable @update:model-value="reading = null">
    <v-card v-if="reading">
      <div class="top-bar border-0">
        <v-btn icon="mdi-chevron-left" variant="text" aria-label="戻る" @click="reading = null" />
      </div>
      <v-card-text class="pa-0">
        <LegalDocument :kind="reading" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.welcome {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}
.welcome__title {
  font-size: 28px;
  font-weight: 900;
  line-height: 1.3;
}
.welcome__lead {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.7;
}
.account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  font-size: 13px;
}
.terms {
  align-self: center;
  font-size: 14px;
}
.terms a {
  color: inherit;
  font-weight: 700;
}
.account__text .mono {
  font-size: 12px;
}
</style>

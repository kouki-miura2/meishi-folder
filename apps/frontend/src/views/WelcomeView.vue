<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AffiliationFields, { type AffiliationForm } from '../components/AffiliationFields.vue'
import AppLogo from '../components/AppLogo.vue'
import { useCompaniesQuery } from '../composables/useMasters.ts'
import { useMeQuery, useSaveMeMutation } from '../composables/useMe.ts'
import { useAuthStore } from '../stores/auth.ts'

// 1a: the first-time profile, and later the place to change it (from the account menu).
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
const canSave = computed(() => !!name.value.trim())

const submit = async () => {
  await save.mutateAsync({
    name: name.value,
    nameKana: nameKana.value || null,
    affiliations: affiliations.value
      .filter((a) => a.companyName.trim())
      .map((a) => ({ companyName: a.companyName, departmentName: a.departmentName || null })),
  })
  await router.replace({ name: 'cards' })
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
.account__text .mono {
  font-size: 12px;
}
</style>

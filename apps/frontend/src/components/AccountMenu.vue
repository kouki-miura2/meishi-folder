<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useMeQuery } from '../composables/useMe.ts'
import { disableGoogleAutoSelect } from '../lib/google-identity.ts'
import { useAuthStore } from '../stores/auth.ts'

// The avatar on the card list: the way into the profile and the master settings.
const auth = useAuthStore()
const router = useRouter()
const queryClient = useQueryClient()
const { data: me } = useMeQuery()

const initial = computed(() => (me.value?.name ?? auth.profile?.name ?? '?').trim().charAt(0))

const signOut = async () => {
  disableGoogleAutoSelect()
  auth.signOut()
  queryClient.clear()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: activator }">
      <v-btn
        v-bind="activator"
        icon
        variant="flat"
        color="surface-variant"
        size="44"
        aria-label="メニュー"
      >
        <v-avatar size="44" color="#D9D4C7">
          <v-img v-if="auth.profile?.picture" :src="auth.profile.picture" alt="" />
          <span v-else class="font-weight-bold">{{ initial }}</span>
        </v-avatar>
      </v-btn>
    </template>
    <v-list density="comfortable" min-width="220">
      <v-list-item :subtitle="auth.profile?.email" :title="me?.name ?? auth.profile?.name" />
      <v-divider />
      <v-list-item
        prepend-icon="mdi-account-edit-outline"
        title="プロフィール・所属"
        :to="{ name: 'welcome' }"
      />
      <v-list-item prepend-icon="mdi-domain" title="会社・団体の設定" :to="{ name: 'companies' }" />
      <v-list-item prepend-icon="mdi-logout" title="ログアウト" @click="signOut" />
    </v-list>
  </v-menu>
</template>

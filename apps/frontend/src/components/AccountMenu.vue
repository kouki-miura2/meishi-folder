<script setup lang="ts">
import { computed } from 'vue'

import { useMeQuery } from '../composables/useMe.ts'
import { useSignOut } from '../composables/useSignOut.ts'
import { useAuthStore } from '../stores/auth.ts'

// The avatar on the card list: the way into the settings screen, and signing out.
const auth = useAuthStore()
const { data: me } = useMeQuery()
const signOut = useSignOut()

const initial = computed(() => (me.value?.name ?? auth.profile?.name ?? '?').trim().charAt(0))
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
      <v-list-item prepend-icon="mdi-cog-outline" title="設定" :to="{ name: 'settings' }" />
      <v-list-item prepend-icon="mdi-logout" title="ログアウト" @click="signOut" />
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { usePwaUpdate } from './composables/usePwaUpdate.ts'
import { useNotificationStore } from './stores/notification.ts'

const notification = useNotificationStore()
const { needRefresh, update } = usePwaUpdate()
</script>

<template>
  <v-app>
    <div class="app-shell">
      <router-view />
    </div>
    <v-snackbar v-model="notification.visible" location="top" color="primary">
      {{ notification.message }}
    </v-snackbar>
    <!-- A new version of the app: stays until tapped, behind any other message shown meanwhile. -->
    <v-snackbar
      :model-value="needRefresh && !notification.visible"
      location="bottom"
      :timeout="-1"
      color="primary"
    >
      新しいバージョンがあります
      <template #actions>
        <v-btn variant="text" @click="needRefresh = false">後で</v-btn>
        <v-btn variant="text" @click="update">更新</v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { useNotificationStore } from './stores/notification.ts'

const notification = useNotificationStore()
</script>

<template>
  <v-app>
    <div class="app-shell">
      <router-view />
    </div>
    <v-snackbar v-model="notification.visible" location="top" color="primary">
      {{ notification.message }}
    </v-snackbar>
  </v-app>
</template>

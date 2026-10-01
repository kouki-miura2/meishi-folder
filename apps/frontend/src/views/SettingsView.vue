<script setup lang="ts">
import { formatDate } from 'utils'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useExportCardsMutation } from '../composables/useCards.ts'
import { useInstallApp } from '../composables/useInstallApp.ts'
import { useDeleteMeMutation, useMeQuery } from '../composables/useMe.ts'
import { useSignOut } from '../composables/useSignOut.ts'
import { saveFile } from '../lib/download.ts'
import { useAuthStore } from '../stores/auth.ts'

// Settings (not in the design): profile and masters, the CSV export, installing the app, outside
// pages, withdrawal.
const auth = useAuthStore()
const router = useRouter()
const exportCards = useExportCardsMutation()
const { data: me } = useMeQuery()
const deleteMe = useDeleteMeMutation()
const signOut = useSignOut()
const install = useInstallApp()

// Pages still to be written: a row stays disabled until its url is set.
const links: { title: string; url: string | null }[] = [
  { title: 'ヘルプ', url: null },
  { title: '利用規約', url: '/terms' },
  { title: 'プライバシーポリシー', url: '/privacy' },
]

// Withdrawal takes two steps: the notice, then typing the profile's name as the final check.
const withdrawing = ref(false)
const confirmingWithdrawal = ref(false)
const typedName = ref('')
const nameMatches = computed(() => !!me.value && typedName.value.trim() === me.value.name.trim())
const showingInstallSteps = ref(false)

// Installs directly where the browser can; iOS can't from a script, so it gets the steps instead.
const installApp = () => {
  if (install.mode.value === 'prompt') void install.prompt()
  else showingInstallSteps.value = true
}

const download = async () => {
  const csv = await exportCards.mutateAsync()
  saveFile(csv, `meishi-folder-${formatDate(new Date(), 'yyyyMMdd')}.csv`)
}

const confirmWithdrawal = () => {
  withdrawing.value = false
  typedName.value = ''
  confirmingWithdrawal.value = true
}

const withdraw = async () => {
  if (!nameMatches.value || deleteMe.isPending.value) return
  await deleteMe.mutateAsync()
  confirmingWithdrawal.value = false
  await signOut()
}
</script>

<template>
  <div class="top-bar border-0">
    <v-btn
      variant="text"
      prepend-icon="mdi-chevron-left"
      class="px-2"
      @click="router.push({ name: 'cards' })"
    >
      名刺
    </v-btn>
  </div>
  <div class="page">
    <h1 class="page-title mb-4">設定</h1>

    <v-list class="panel py-0 mb-4">
      <v-list-item :title="me?.name ?? auth.profile?.name" :subtitle="auth.profile?.email">
        <template #prepend>
          <v-avatar size="40" color="#D9D4C7" class="mr-1">
            <v-img v-if="auth.profile?.picture" :src="auth.profile.picture" alt="" />
            <v-icon v-else icon="mdi-account" />
          </v-avatar>
        </template>
      </v-list-item>
      <v-divider />
      <v-list-item
        prepend-icon="mdi-account-edit-outline"
        append-icon="mdi-chevron-right"
        title="プロフィール・所属"
        :to="{ name: 'welcome' }"
      />
      <v-divider />
      <v-list-item
        prepend-icon="mdi-domain"
        append-icon="mdi-chevron-right"
        title="会社・団体の設定"
        :to="{ name: 'companies' }"
      />
    </v-list>

    <v-list class="panel py-0 mb-4">
      <v-list-item
        prepend-icon="mdi-download-outline"
        title="名刺データをダウンロード"
        subtitle="CSV ファイル。他のアプリへの移行に使えます"
        :disabled="exportCards.isPending.value"
        @click="download"
      >
        <template v-if="exportCards.isPending.value" #append>
          <v-progress-circular indeterminate size="20" width="2" />
        </template>
      </v-list-item>
    </v-list>

    <!-- Only in the browser: hidden once opened from the home screen. -->
    <v-list v-if="install.mode.value" class="panel py-0 mb-4">
      <v-list-item
        prepend-icon="mdi-cellphone-arrow-down"
        title="アプリをインストール"
        subtitle="ホーム画面から全画面で開けます"
        @click="installApp"
      />
    </v-list>

    <v-list class="panel py-0">
      <template v-for="link in links" :key="link.title">
        <v-list-item
          :title="link.title"
          append-icon="mdi-open-in-new"
          :href="link.url ?? undefined"
          target="_blank"
          rel="noopener"
          :disabled="!link.url"
        />
        <v-divider />
      </template>
      <v-list-item
        title="退会する（すべてのデータを削除）"
        base-color="error"
        class="withdraw"
        @click="withdrawing = true"
      />
    </v-list>
  </div>

  <v-dialog v-model="showingInstallSteps" max-width="360">
    <v-card title="ホーム画面に追加する">
      <v-card-text>
        {{ install.mode.value === 'ios-safari' ? 'Safari' : 'ブラウザ' }} の共有ボタン（<v-icon
          icon="mdi-export-variant"
          size="small"
          aria-label="共有"
        />）をタップし、「ホーム画面に追加」を選んでください。「Webアプリとして開く」はオンのままにします。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showingInstallSteps = false">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="withdrawing" max-width="360">
    <v-card title="退会しますか？">
      <v-card-text>
        名刺・名刺写真・会社・団体・プロフィールなど、すべてのデータを削除します。元に戻せません。<br />
        必要なら先に「名刺データをダウンロード」で CSV を保存してください。
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="withdrawing = false">キャンセル</v-btn>
        <v-btn color="error" @click="confirmWithdrawal">削除する</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmingWithdrawal" max-width="360">
    <v-card title="最終確認">
      <v-card-text>
        退会を確定するには、プロフィールの氏名「{{ me?.name }}」を入力してください。
        <v-text-field
          v-model="typedName"
          label="氏名"
          autocomplete="off"
          class="mt-4"
          hide-details
          @keydown.enter="withdraw"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmingWithdrawal = false">キャンセル</v-btn>
        <v-btn
          color="error"
          :disabled="!nameMatches"
          :loading="deleteMe.isPending.value"
          @click="withdraw"
        >
          退会する
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.withdraw {
  background: rgba(var(--v-theme-error), 0.06);
}
</style>

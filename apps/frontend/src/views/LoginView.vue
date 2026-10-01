<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppLogo from '../components/AppLogo.vue'
import { useSignInMutation } from '../composables/useSession.ts'
import { initGoogleSignIn } from '../lib/google-identity.ts'
import { useAuthStore } from '../stores/auth.ts'

// Not in the design: a sign-in screen in the tone of the welcome screen (1a).
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const button = ref<HTMLElement | null>(null)
const failed = ref(false)
const signIn = useSignInMutation()

const redirect = () =>
  router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/')

onMounted(async () => {
  if (auth.isSignedIn()) {
    await redirect()
    return
  }
  try {
    const id = await initGoogleSignIn((idToken) => {
      signIn.mutate(idToken, { onSuccess: () => void redirect() })
    })
    if (button.value) {
      id.renderButton(button.value, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'ja',
        width: 300,
      })
    }
    // A returning user is signed straight back in.
    id.prompt()
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div class="page login">
    <AppLogo />
    <div>
      <h1 class="login__title">Meishi-folder</h1>
      <p class="muted login__lead">
        もらった名刺を撮影して、<br />会社・場面・つながりごとに整理します。
      </p>
    </div>
    <div class="flex-grow-1" />
    <div class="login__actions">
      <v-progress-circular v-if="signIn.isPending.value" indeterminate size="44" />
      <div v-show="!signIn.isPending.value" ref="button" class="login__button" />
      <p v-if="failed" class="text-error text-body-2">
        Google ログインを読み込めませんでした。通信環境を確認して、再読み込みしてください。
      </p>
      <p class="faint text-caption text-center">登録データはあなただけが参照できます</p>
    </div>
  </div>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 64px;
  padding-bottom: calc(34px + env(safe-area-inset-bottom));
}
.login__title {
  font-size: 30px;
  font-weight: 900;
}
.login__lead {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.7;
}
.login__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.login__button {
  min-height: 44px;
}
</style>

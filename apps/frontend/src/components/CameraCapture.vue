<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// 1d: photograph the front, then the back (or skip it). Without a usable camera (desktop, denied
// permission) the same flow works by choosing photo files.
const emit = defineEmits<{ done: [front: Blob, back: Blob | null]; cancel: [] }>()

const video = ref<HTMLVideoElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const stream = ref<MediaStream | null>(null)
const cameraFailed = ref(false)
const front = ref<Blob | null>(null)
const side = ref<'front' | 'back'>('front')

onMounted(async () => {
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    if (video.value) video.value.srcObject = stream.value
  } catch {
    cameraFailed.value = true
  }
})
onBeforeUnmount(() => stream.value?.getTracks().forEach((track) => track.stop()))

const accept = (photo: Blob) => {
  if (side.value === 'front') {
    front.value = photo
    side.value = 'back'
  } else if (front.value) {
    emit('done', front.value, photo)
  }
}

const shoot = () => {
  const v = video.value
  if (!v || !v.videoWidth) return
  const canvas = document.createElement('canvas')
  canvas.width = v.videoWidth
  canvas.height = v.videoHeight
  canvas.getContext('2d')?.drawImage(v, 0, 0)
  canvas.toBlob((blob) => blob && accept(blob), 'image/jpeg', 0.92)
}

const choose = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) accept(file)
}

const skipBack = () => {
  if (front.value) emit('done', front.value, null)
}
</script>

<template>
  <div class="camera">
    <div class="camera__bar">
      <v-btn
        icon="mdi-close"
        variant="text"
        color="white"
        aria-label="やめる"
        @click="emit('cancel')"
      />
      <div class="sides">
        <span :class="{ active: side === 'front' }">表面</span>
        <span :class="{ active: side === 'back' }">裏面</span>
      </div>
      <span class="mono camera__step">{{ side === 'front' ? 1 : 2 }}/2</span>
    </div>

    <div class="camera__stage">
      <div class="frame">
        <video v-show="!cameraFailed" ref="video" autoplay playsinline muted class="frame__video" />
        <div v-if="cameraFailed" class="frame__fallback mono">camera unavailable</div>
        <span class="corner tl" /><span class="corner tr" /><span class="corner bl" /><span
          class="corner br"
        />
      </div>
      <div class="hint">
        <template v-if="cameraFailed"
          >カメラを使えません。「写真を選択」から画像を選んでください</template
        >
        <template v-else
          >名刺の<b>{{ side === 'front' ? '表面' : '裏面' }}</b
          >を枠に合わせてください</template
        >
      </div>
    </div>

    <div class="camera__controls">
      <button type="button" class="control" @click="fileInput?.click()">
        <span class="control__icon"><v-icon icon="mdi-image-outline" /></span>写真を選択
      </button>
      <button
        type="button"
        class="shutter"
        :disabled="cameraFailed"
        aria-label="撮影"
        @click="shoot"
      >
        <span />
      </button>
      <button
        type="button"
        class="control"
        :style="{ visibility: side === 'back' ? 'visible' : 'hidden' }"
        @click="skipBack"
      >
        <span class="control__icon control__icon--round">→</span>裏面をスキップ
      </button>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="choose" />
    </div>
  </div>
</template>

<style scoped>
.camera {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: #111110;
  color: #f5f3ee;
}
.camera__bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
}
.camera__step {
  width: 44px;
  text-align: center;
  font-size: 12px;
}
.sides {
  display: flex;
  padding: 3px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 13px;
  font-weight: 700;
}
.sides span {
  padding: 7px 16px;
  border-radius: 17px;
  color: rgba(255, 255, 255, 0.6);
}
.sides span.active {
  background: #f5f3ee;
  color: #1b1a17;
}
.camera__stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 0 20px;
  background: repeating-linear-gradient(135deg, #1c1b19 0 14px, #211f1c 14px 28px);
}
.frame {
  position: relative;
  width: 100%;
  max-width: 360px;
  aspect-ratio: 91 / 55;
}
.frame__video,
.frame__fallback {
  position: absolute;
  inset: 8px;
  width: calc(100% - 16px);
  height: calc(100% - 16px);
  object-fit: cover;
  border-radius: 4px;
}
.frame__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a2926;
  color: #8b867b;
  font-size: 11px;
}
.corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border-color: #e9b949;
  border-style: solid;
  border-width: 0;
}
.tl {
  left: 0;
  top: 0;
  border-left-width: 3px;
  border-top-width: 3px;
  border-radius: 6px 0 0 0;
}
.tr {
  right: 0;
  top: 0;
  border-right-width: 3px;
  border-top-width: 3px;
  border-radius: 0 6px 0 0;
}
.bl {
  left: 0;
  bottom: 0;
  border-left-width: 3px;
  border-bottom-width: 3px;
  border-radius: 0 0 0 6px;
}
.br {
  right: 0;
  bottom: 0;
  border-right-width: 3px;
  border-bottom-width: 3px;
  border-radius: 0 0 6px 0;
}
.hint {
  padding: 8px 14px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.5);
  font-size: 13px;
  text-align: center;
}
.camera__controls {
  height: 170px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 20px calc(20px + env(safe-area-inset-bottom));
}
.control {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  width: 80px;
}
.control__icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #f5f3ee;
}
.control__icon--round {
  border-radius: 24px;
  background: none;
  font-weight: 700;
}
.shutter {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 4px solid #f5f3ee;
  display: flex;
  align-items: center;
  justify-content: center;
}
.shutter span {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #f5f3ee;
}
.shutter:disabled {
  opacity: 0.3;
}
</style>

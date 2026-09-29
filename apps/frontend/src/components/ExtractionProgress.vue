<script setup lang="ts">
// 1e: what is happening while the card is read. `step` is the index of the running step.
defineProps<{ step: number }>()
defineEmits<{ skip: [] }>()

const steps = [
  '画像をアップロード',
  '記載項目をAIで抽出',
  '会社・部署マスタと照合',
  '登録済みの名刺と照合',
]
</script>

<template>
  <div class="progress">
    <div class="stack" aria-hidden="true">
      <div class="stack__back mono">back</div>
      <div class="stack__front">
        <span class="line line--short" />
        <span class="line line--name" />
        <span class="line" />
        <span class="flex-grow-1" />
        <span class="line line--short" />
        <span class="scan" />
      </div>
    </div>
    <div class="text-center">
      <div class="progress__title">名刺を読み取っています</div>
      <div class="muted text-body-2 mt-2">通常 5〜10秒ほどかかります</div>
    </div>
    <ol class="steps">
      <li v-for="(label, i) in steps" :key="label" :class="{ done: i < step, running: i === step }">
        <span class="mark">{{ i < step ? '✓' : '' }}</span
        >{{ label }}
      </li>
    </ol>
  </div>
  <div class="px-5 pb-8">
    <v-btn block variant="text" class="muted" height="50" @click="$emit('skip')"
      >スキップして手入力</v-btn
    >
  </div>
</template>

<style scoped>
.progress {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 36px;
  padding: 0 32px;
}
.stack {
  position: relative;
  width: 260px;
  height: 190px;
}
.stack__back {
  position: absolute;
  left: 40px;
  top: 0;
  width: 210px;
  height: 128px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 5px;
  transform: rotate(5deg);
  color: var(--faint);
  font-size: 10px;
}
.stack__front {
  position: absolute;
  left: 0;
  top: 44px;
  width: 230px;
  height: 140px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 5px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}
.line {
  width: 60%;
  height: 4px;
  background: #c9c4b8;
  border-radius: 2px;
}
.line--short {
  width: 35%;
}
.line--name {
  width: 50%;
  height: 10px;
  background: #f6e7b9;
}
.scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: #e9b949;
  box-shadow: 0 0 12px 3px rgba(233, 185, 73, 0.6);
  animation: scan 1.6s ease-in-out infinite alternate;
}
@keyframes scan {
  from {
    top: 12%;
  }
  to {
    top: 88%;
  }
}
.progress__title {
  font-size: 22px;
  font-weight: 900;
}
.steps {
  width: 100%;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  color: var(--faint);
}
.steps li {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mark {
  width: 22px;
  height: 22px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1.5px solid #d8d3c8;
  font-size: 12px;
}
.steps li.done {
  color: #1b1a17;
}
.steps li.done .mark {
  background: #1b1a17;
  border-color: #1b1a17;
  color: #fff;
}
.steps li.running {
  color: #1b1a17;
  font-weight: 700;
}
.steps li.running .mark {
  border: 2.5px solid #e9b949;
  border-right-color: transparent;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

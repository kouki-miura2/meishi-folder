<template>
  <!-- Two stacked cards: the mark from the welcome screen (1a). -->
  <div class="logo" aria-hidden="true">
    <div class="logo__back" />
    <div class="logo__front"><span /></div>
  </div>
</template>

<style scoped>
.logo {
  position: relative;
  width: 88px;
  height: 62px;
}
.logo__back {
  position: absolute;
  left: 14px;
  top: 0;
  width: 74px;
  height: 46px;
  background: #fff;
  border: 1px solid #d8d3c8;
  border-radius: 4px;
  transform: rotate(6deg);
}
.logo__front {
  position: absolute;
  left: 0;
  top: 12px;
  width: 74px;
  height: 46px;
  background: #1b1a17;
  border-radius: 4px;
  display: flex;
  align-items: flex-end;
  padding: 7px;
}
.logo__front span {
  width: 26px;
  height: 3px;
  background: #f5f3ee;
  border-radius: 2px;
}
</style>

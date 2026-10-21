<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ amount: number; small?: boolean }>(), { small: false })
const denominations = [1000, 500, 100, 25, 5, 1]
const stacks = computed(() => {
  let remaining = Math.max(0, Math.floor(props.amount))
  return denominations.flatMap(value => {
    const count = Math.floor(remaining / value)
    remaining %= value
    return count ? [{ value, count: Math.min(count, props.small ? 3 : 5) }] : []
  }).slice(0, props.small ? 2 : 4)
})
</script>

<template>
  <span class="chip-stacks" :class="{ compact: small }" aria-hidden="true">
    <span v-for="stack in stacks" :key="stack.value" class="chip-column" :style="{ '--layers': stack.count }">
      <i v-for="layer in stack.count" :key="layer" class="poker-chip" :class="`chip-${stack.value}`" :style="{ '--layer': layer - 1 }"><b>{{ stack.value === 1000 ? '1K' : stack.value }}</b></i>
    </span>
  </span>
</template>

<style scoped>
.chip-stacks { --size: 29px; --step: 3px; display: inline-flex; align-items: end; gap: 3px; height: 41px; flex-shrink: 0; vertical-align: middle; }
.chip-column { width: var(--size); height: calc(var(--size) + (var(--layers) - 1) * var(--step)); position: relative; }
.poker-chip { --chip: #bd5f68; position: absolute; width: var(--size); height: var(--size); bottom: calc(var(--layer) * var(--step)); left: 0; border-radius: 50%; background: var(--chip); border: 3px dashed #f1e9d2; box-shadow: 0 2px 0 #09150f, 0 3px 2px #0006, inset 0 0 0 1px #fff5; display: grid; place-items: center; font-style: normal; }
.poker-chip b { display: grid; place-items: center; width: 80%; height: 80%; border: 1px solid #fff6; border-radius: 50%; font: 600 8px var(--numbers); color: #fff5e3; }
.chip-1000 { --chip: #786299; }.chip-500 { --chip: #bb9752; }.chip-100 { --chip: #343e46; }.chip-25 { --chip: #438e77; }.chip-5 { --chip: #bd5f68; }.chip-1 { --chip: #84989b; }
.compact { --size: 17px; --step: 2px; height: 24px; gap: 1px; }.compact .poker-chip { border-width: 2px; }.compact .poker-chip b { font-size: 5px; }
@media(max-width:600px) { .chip-stacks:not(.compact) { --size: 23px; height: 35px; }.poker-chip b { font-size: 7px; } }
</style>

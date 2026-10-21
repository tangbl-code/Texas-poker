<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
const props = withDefaults(defineProps<{ card?: string; hidden?: boolean; small?: boolean; empty?: boolean; animate?: boolean; dealDelay?: number }>(), { hidden: false, small: false, empty: false, animate: false, dealDelay: 0 })
const element = ref<HTMLElement>()
function deal() {
  if (!props.animate || !props.card || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  element.value?.animate([
    { opacity: 0, transform: 'translateY(-32px) rotateY(90deg) scale(.8)' },
    { opacity: 1, transform: 'translateY(0) rotateY(0) scale(1)' },
  ], { duration: 420, delay: props.dealDelay, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' })
}
onMounted(deal)
watch(() => props.card, deal, { flush: 'post' })
const suits: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const rank = computed(() => props.card?.[0] === 'T' ? '10' : props.card?.[0])
const suit = computed(() => suits[props.card?.[1] ?? 's'])
const red = computed(() => props.card?.[1] === 'h' || props.card?.[1] === 'd')
</script>

<template>
  <div ref="element" class="playing-card" :class="{ red, hidden, small, empty }" :aria-label="empty ? '待发牌' : hidden ? '底牌未公开' : `${rank}${suit}`">
    <template v-if="!hidden && !empty && card">
      <span class="corner">{{ rank }}<span>{{ suit }}</span></span>
      <span class="center-suit">{{ suit }}</span>
      <span class="corner bottom">{{ rank }}<span>{{ suit }}</span></span>
    </template>
    <span v-else-if="hidden" class="back-symbol">♠</span>
    <span v-else class="empty-symbol">♠</span>
  </div>
</template>

<style scoped>
.playing-card { position: relative; width: 68px; height: 96px; flex: 0 0 auto; border-radius: 6px; background: #fff; color: #222c2a; box-shadow: 0 3px 6px #0002; font-family: Georgia, serif; user-select: none; }
.red { color: #cc4b4f; }
.corner { position: absolute; top: 6px; left: 7px; display: flex; flex-direction: column; align-items: center; font-size: 20px; font-weight: 700; line-height: 1; }
.corner span { font-size: 15px; margin-top: 2px; }
.bottom { top: auto; left: auto; bottom: 6px; right: 7px; transform: rotate(180deg); }
.center-suit { position: absolute; inset: 0; display: grid; place-items: center; font-size: 34px; }
.hidden { background-color: #e5ece8; background-image: repeating-linear-gradient(45deg, #315f521c 0px, #315f521c 1px, transparent 1px, transparent 5px), repeating-linear-gradient(-45deg, #315f521c 0px, #315f521c 1px, transparent 1px, transparent 5px); border: 4px solid #fff; }
.back-symbol { position: absolute; inset: 8px; display: grid; place-items: center; border: 1px solid #55786b77; border-radius: 3px; font-size: 30px; color: #376655; }
.empty { background: #ffffff05; border: 1px dashed #bcd3c144; box-shadow: none; }
.empty-symbol { display: grid; place-items: center; height: 100%; font-size: 25px; color: #bdd6c01c; }
.small { width: 35px; height: 48px; border-radius: 3px; }
.small .corner { top: 3px; left: 4px; font-size: 13px; }
.small .corner span { font-size: 11px; }
.small .center-suit { font-size: 17px; justify-content: end; padding: 4px; align-items: end; }
.small .bottom { display: none; }
.small.hidden { border-width: 2px; }
.small .back-symbol { inset: 3px; font-size: 16px; }
@media (max-width: 600px) { .playing-card:not(.small) { width: 49px; height: 71px; } .corner { font-size: 16px; left: 5px; top: 5px; } .corner span { font-size: 12px; } .bottom { left: auto; top: auto; bottom: 5px; right: 5px; } .center-suit { font-size: 25px; } }
</style>

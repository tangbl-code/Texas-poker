<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowUpRight, CheckCheck, Coins, Flag, Flame, LoaderCircle, Minus, Plus } from 'lucide-vue-next'
import { useRoomStore } from '../stores/room'
import { pot, raiseAllowed, type Game } from '../game/engine'

const room = useRoomStore()
const raiseTo = ref(0)
const game = computed(() => room.view!.game!)
const player = computed(() => room.me!)
const myTurn = computed(() => game.value.turn === room.view?.me && game.value.street !== 'showdown' && room.connected)
const toCall = computed(() => Math.min(player.value.chips, Math.max(0, game.value.currentBet - player.value.bet)))
const maximum = computed(() => player.value.bet + player.value.chips)
const minimum = computed(() => Math.min(maximum.value, game.value.currentBet + game.value.minRaise))
const canRaise = computed(() => myTurn.value && raiseAllowed(game.value as Game) && maximum.value > game.value.currentBet)
const validRaise = computed(() => canRaise.value && Number.isInteger(raiseTo.value) && raiseTo.value >= minimum.value && raiseTo.value <= maximum.value)
const canAllIn = computed(() => myTurn.value && (canRaise.value || maximum.value <= game.value.currentBet))
const callIsAllIn = computed(() => toCall.value > 0 && toCall.value === player.value.chips)
const fmt = (value: number) => value.toLocaleString('en-US')
watch(() => [game.value.turn, game.value.round, game.value.street, game.value.currentBet], () => {
  raiseTo.value = minimum.value
}, { immediate: true })
function allIn() {
  if (!canAllIn.value) return
  room.action(maximum.value > game.value.currentBet ? 'raise' : 'call', maximum.value)
}
function preset(fraction: number) {
  raiseTo.value = Math.min(maximum.value, Math.max(minimum.value, game.value.currentBet + Math.floor(pot(game.value as Game) * fraction)))
}
</script>

<template>
  <section class="poker-actions" :class="{ 'without-raise': !canRaise }" aria-label="牌局操作">
    <template v-if="myTurn">
      <div class="action-heading"><span class="your-move"><span></span>轮到你行动</span><span class="call-cost">{{ toCall ? '需要跟注' : '可免费过牌' }}<b v-if="toCall">{{ fmt(toCall) }}</b></span></div>
      <div v-if="canRaise" class="raise-editor">
        <div class="raise-header"><label for="raise-amount">{{ game.currentBet ? '加注至' : '下注至' }}<small>本街总额</small></label><div class="amount-stepper"><button title="减少加注金额" :disabled="raiseTo <= minimum" @click="raiseTo = Math.max(minimum, raiseTo - game.minRaise)"><Minus :size="15" /></button><input id="raise-amount" v-model.number="raiseTo" type="number" :min="minimum" :max="maximum" step="1" /><button title="增加加注金额" :disabled="raiseTo >= maximum" @click="raiseTo = Math.min(maximum, raiseTo + game.minRaise)"><Plus :size="15" /></button></div></div>
        <div class="raise-shortcuts"><input v-model.number="raiseTo" type="range" aria-label="加注金额滑块" :min="minimum" :max="maximum" step="1" /><div class="bet-presets"><button @click="raiseTo = minimum">最小</button><button @click="preset(.5)">½ 底池</button><button @click="preset(1)">底池</button></div></div>
      </div>
      <div class="action-buttons">
        <button class="action-button fold-button" @click="room.action('fold')"><Flag :size="19" /><span>弃牌<small>FOLD</small></span></button>
        <button class="action-button call-button" :class="{ 'check-button': !toCall, 'is-all-in': callIsAllIn }" @click="room.action('call')"><component :is="callIsAllIn ? Flame : toCall ? Coins : CheckCheck" :size="23" /><span>{{ callIsAllIn ? '跟注全下' : toCall ? '跟注' : '过牌' }}<small>{{ callIsAllIn ? 'ALL IN' : toCall ? 'CALL' : 'CHECK' }}</small></span><b v-if="toCall">{{ fmt(toCall) }}</b></button>
        <button class="action-button raise-button" :class="{ 'is-all-in': canRaise && raiseTo === maximum }" :disabled="!validRaise" @click="room.action('raise', raiseTo)"><ArrowUpRight :size="23" /><span>{{ canRaise && raiseTo === maximum ? '全下' : game.currentBet ? '加注至' : '下注' }}<small>{{ game.currentBet ? 'RAISE' : 'BET' }}</small></span><b v-if="validRaise">{{ fmt(raiseTo) }}</b></button>
        <button class="action-button all-in-button" :disabled="!canAllIn" :title="!canAllIn ? '本轮尚未重新开放加注' : `全下 ${fmt(player.chips)}`" @click="allIn"><Flame :size="23" /><span>全下<small>ALL IN</small></span><b>{{ fmt(player.chips) }}</b></button>
      </div>
    </template>
    <div v-else class="waiting-action"><LoaderCircle v-if="!player.folded && player.chips > 0" :size="23" class="spin" /><Flag v-else-if="player.folded" :size="23" /><Flame v-else :size="23" /><div><b>{{ player.folded ? '本轮已弃牌' : player.chips === 0 ? '已全下，等待开牌' : `等待 ${game.players[game.turn]?.name} 行动` }}</b><span>本轮已投入 {{ fmt(player.invested) }} 筹码</span></div></div>
  </section>
</template>

<style scoped>
.poker-actions { min-width: 0; width: 100%; display: grid; grid-template-columns: minmax(185px, .8fr) minmax(360px, 1.5fr); align-items: center; gap: 14px; }
.action-heading { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.raise-editor { min-width: 0; }
.raise-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.raise-header label { font-size: 10px; color: #9baea5; white-space: nowrap; }
.raise-header small { display: none; }
.amount-stepper { height: 30px; width: 124px; display: flex; align-items: center; background: #172820; border: 1px solid #3e554a; border-radius: 4px; }
.amount-stepper button { border: 0; background: none; color: #a1b6aa; width: 28px; height: 100%; flex-shrink: 0; display: grid; place-items: center; }
.amount-stepper input { height: 100%; padding: 0; border: 0; background: none; color: #e6eddf; text-align: center; font-size: 16px; box-shadow: none; }
.raise-shortcuts { display: flex; align-items: center; gap: 7px; margin-top: 4px; }
.raise-shortcuts>input { height: 22px; min-width: 0; flex: 1; padding: 0; border: 0; box-shadow: none; accent-color: #b3b794; background: none; }
.bet-presets { display: flex; gap: 4px; flex-shrink: 0; }
.bet-presets button { padding: 0 6px; height: 25px; border: 1px solid #3a5146; border-radius: 3px; background: transparent; color: #aebcaf; font-size: 9px; }
.bet-presets button:hover { border-color: #a2b18d; color: #edf2e6; }
.action-buttons { display: grid; grid-template-columns: .7fr 1.15fr 1.2fr 1.1fr; gap: 7px; }
.without-raise .action-buttons { grid-column: 1 / -1; }
.action-button { min-width: 0; height: 44px; border: 1px solid #53614c; border-radius: 5px; padding: 0 9px; background: #293a30; color: #d3dbcb; display: flex; justify-content: center; align-items: center; gap: 6px; transition: background .15s, border-color .15s; }
.action-button svg { width: 16px; height: 16px; flex-shrink: 0; }
.action-button>span { font-size: 12px; font-weight: 500; white-space: nowrap; }
.action-button small { display: none; }
.action-button>b { font-size: 13px; font-family: var(--numbers); font-weight: 500; white-space: nowrap; }
.fold-button { background: transparent; color: #98a69b; border-color: #3a4c42; }
.call-button { background: #55543a; border-color: #80754c; color: #f1dfad; }
.check-button { background: #29494a; border-color: #496c6b; color: #b7ddd6; }
.raise-button { background: #304a50; border-color: #52747a; color: #d6e8e6; }
.all-in-button,.is-all-in { background: #4d3032; border-color: #7a4b4d; color: #efb6ab; }
.action-button:hover:not(:disabled) { border-color: #c6c8a2; background: #425441; }
.action-button:active:not(:disabled) { transform: translateY(1px); }
.action-button:disabled { opacity: .35; }
.waiting-action { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 59px; color: #8caa94; }
.waiting-action b { font-size: 12px; font-weight: 500; color: #b5c2b6; }
.waiting-action span { display: block; margin-top: 5px; font-size: 10px; color: #7d9585; }
@media(max-width:1100px) { .poker-actions { grid-template-columns: minmax(170px, .7fr) minmax(300px, 1.3fr); gap: 10px; }.action-button { padding-inline: 5px; gap: 4px; }.action-button svg { display: none; } }
@media(max-width:800px) { .poker-actions { grid-template-columns: 1fr; gap: 7px; }.raise-editor { display: flex; align-items: center; gap: 10px; }.raise-header { flex: 1; }.raise-shortcuts { margin: 0; flex: 1; }.raise-shortcuts>input { width: 50px; }.action-button svg { display: block; }.waiting-action { min-height: 82px; } }
@media(max-width:600px) { .raise-editor { gap: 8px; }.raise-shortcuts { flex: 0; }.raise-shortcuts>input { display: none; }.amount-stepper { width: 112px; height: 32px; }.amount-stepper button { width: 25px; }.raise-header { gap: 5px; }.raise-header label { font-size: 9px; }.bet-presets button { font-size: 9px; padding: 0 5px; height: 30px; }.action-buttons { gap: 5px; }.action-button { height: 44px; display: grid; grid-template-columns: auto auto; align-content: center; gap: 1px 4px; padding-inline: 4px; }.action-button>span { font-size: 11px; }.action-button svg { width: 14px; height: 14px; }.action-button>b { grid-column: 1 / -1; text-align: center; font-size: 12px; }.fold-button { display: flex; }.waiting-action { min-height: 83px; } }
@media(max-width:350px) { .amount-stepper { width: 101px; }.bet-presets { gap: 2px; }.bet-presets button { padding-inline: 4px; }.raise-editor { gap: 5px; }.action-button svg { display: none; }.action-button { grid-template-columns: 1fr; } }
@media(max-width:600px) { .raise-editor { display: grid; grid-template-columns: minmax(0, 1fr) max-content; }.raise-header { min-width: 0; }.raise-shortcuts { min-width: 0; } }
@media(prefers-reduced-motion:reduce) { .action-button { transition: none; } }
</style>

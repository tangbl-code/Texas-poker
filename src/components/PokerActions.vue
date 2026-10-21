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
  <section class="poker-actions" aria-label="牌局操作">
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
.poker-actions { width: 100%; min-width: 0; }.action-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 10px; }.your-move { font-size: 12px; font-weight: 600; color: #487c57; display: flex; align-items: center; gap: 7px; }.your-move>span { width: 6px; height: 6px; background: #5da074; border-radius: 50%; box-shadow: 0 0 0 4px #5da07418; }.call-cost { font-size: 11px; color: #91a082; }.call-cost b { font-family: var(--numbers); font-size: 14px; margin-left: 8px; color: #526c43; }.action-buttons { display: grid; grid-template-columns: .72fr 1.35fr 1fr 1.25fr; gap: 10px; }.action-button { min-height: 66px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 14px; border-radius: 6px; border: 1px solid transparent; position: relative; box-shadow: 0 3px 0 #00000012; transition: transform .16s, box-shadow .16s, filter .16s; }.action-button:hover:not(:disabled) { transform: translateY(-3px); filter: brightness(1.04); box-shadow: 0 6px 0 #00000012; }.action-button:active:not(:disabled) { transform: translateY(1px); box-shadow: 0 1px 0 #00000010; }.action-button>span { font-size: 16px; font-weight: 650; text-align: left; white-space: nowrap; }.action-button small { display: block; font-size: 8px; font-weight: 500; margin-top: 5px; opacity: .7; }.action-button>b { font-size: 18px; font-family: var(--numbers); margin-left: auto; font-weight: 550; }.action-button svg { flex-shrink: 0; }.fold-button { color: #87917f; background: #f0f2ed; border-color: #dce2d5; box-shadow: 0 3px 0 #dce2d5; }.call-button { color: #59410c; background: #eed294; border-color: #e1bd6b; box-shadow: 0 3px 0 #d8b871; }.check-button { color: #236d77; background: #d3ecec; border-color: #abd7db; box-shadow: 0 3px 0 #aacecf; }.raise-button { color: #fff; background: #537fc1; border-color: #476db1; box-shadow: 0 3px 0 #3d62a3; }.raise-button.expanded { background: #3e67a9; }.all-in-button,.action-button.is-all-in { color: #fff; background: #c55b59; border-color: #b54b49; box-shadow: 0 3px 0 #a74745; }.all-in-button:not(:disabled)::after { content: ''; position: absolute; inset: 4px; border: 1px solid #ffffff20; border-radius: 3px; pointer-events: none; }.all-in-button svg { color: #ffe0b0; }.action-button:disabled { box-shadow: none; opacity: .32; }.raise-editor { background: #f2f5fb; border: 1px solid #d6e0f0; border-radius: 6px; padding: 16px; margin-bottom: 15px; animation: editor-in .18s ease-out; }.raise-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; }.raise-header label { font-size: 13px; color: #5874a1; }.raise-header small { display: block; font-size: 9px; color: #94a4bc; margin-top: 5px; }.amount-stepper { width: 175px; display: flex; align-items: center; height: 37px; background: #fff; border: 1px solid #d5dff0; border-radius: 4px; }.amount-stepper button { width: 33px; height: 100%; display: grid; place-items: center; border: 0; background: none; color: #6985ae; flex-shrink: 0; }.amount-stepper input { height: 100%; text-align: center; border: 0; padding: 0 4px; box-shadow: none; font-family: var(--numbers); font-size: 17px; }.raise-editor>input { height: 24px; padding: 0; margin: 13px 0 9px; accent-color: #547fc0; border: 0; box-shadow: none; background: none; }.raise-bottom { display: flex; align-items: center; justify-content: space-between; gap: 15px; }.bet-presets { display: flex; gap: 5px; }.bet-presets button { background: #fff; border: 1px solid #dbe3ef; font-size: 10px; color: #748cad; border-radius: 3px; padding: 7px 9px; }.confirm-raise { display: flex; align-items: center; gap: 6px; padding: 9px 14px; border: 0; border-radius: 4px; background: #547fc0; color: #fff; font-size: 11px; }.confirm-raise.is-all-in { background: #c55b59; }.waiting-action { min-height: 90px; display: flex; align-items: center; justify-content: center; gap: 15px; color: #a0af92; }.waiting-action b { display: block; color: #788f65; font-size: 14px; font-weight: 500; }.waiting-action span { display: block; font-size: 11px; margin-top: 8px; color: #a3ae97; }@keyframes editor-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@media(max-width:1050px) { .action-buttons { gap: 7px; }.action-button { gap: 7px; padding: 10px; }.action-button>span { font-size: 14px; }.action-button>b { font-size: 15px; }.action-button>svg { width: 18px; } }
@media(max-width:600px) { .action-buttons { grid-template-columns: .7fr 1.25fr 1fr 1.2fr; gap: 6px; }.action-button { min-height: 65px; flex-direction: column; gap: 4px; padding: 7px 3px; }.action-button>span { font-size: 13px; text-align: center; }.action-button small { display: none; }.action-button>svg { width: 17px; height: 17px; }.action-button>b { margin-left: 0; font-size: 13px; }.call-button,.all-in-button { gap: 2px; }.action-heading { margin-bottom: 10px; }.action-button:hover:not(:disabled) { transform: none; }.raise-editor { padding: 12px; }.raise-bottom { gap: 8px; }.bet-presets button { font-size: 9px; padding: 7px; }.confirm-raise { padding: 9px; font-size: 10px; }.waiting-action { min-height: 65px; }.waiting-action b { font-size: 13px; } }
@media(prefers-reduced-motion:reduce) { .action-button { transition: none; }.raise-editor { animation: none; } }
.raise-editor { padding: 10px 12px; margin-bottom: 10px; animation: none; }
.raise-header { gap: 10px; }
.raise-header label { display: flex; align-items: center; gap: 8px; }
.raise-header small { margin: 0; }
.amount-stepper { height: 36px; width: 160px; }
.raise-shortcuts { display: flex; align-items: center; gap: 12px; margin-top: 5px; }
.raise-shortcuts>input { flex: 1; min-width: 0; height: 24px; padding: 0; border: 0; box-shadow: none; background: none; accent-color: #547fc0; }
.bet-presets { flex-shrink: 0; }
.bet-presets button { min-height: 30px; padding: 4px 9px; }
@media(max-width:600px) { .raise-editor { padding: 7px 9px; margin-bottom: 8px; }.raise-header label { font-size: 11px; gap: 5px; }.raise-header small { font-size: 8px; }.amount-stepper { height: 32px; width: 148px; }.amount-stepper input { font-size: 16px; }.raise-shortcuts { gap: 9px; margin-top: 3px; }.bet-presets button { padding: 4px 7px; }.action-button.raise-button { gap: 2px; }.raise-button>b { margin-left: 0; } }
@media(max-width:600px) and (max-height:620px) { .action-heading { margin-bottom: 6px; }.action-button { min-height: 60px; padding-block: 4px; line-height: 1.2; }.action-button>span { line-height: 1.2; } }
</style>

<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, ref, watch } from 'vue'
import { ArrowRight, CheckCheck, Coins, Copy, Eye, EyeOff, Flag, Flame, Spade, Trophy, WifiOff, X } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import PlayingCard from '../components/PlayingCard.vue'
import PokerActions from '../components/PokerActions.vue'
import PokerChips from '../components/PokerChips.vue'
import { useRoomStore } from '../stores/room'
import { pot, streetNames, type Game } from '../game/engine'

const ConfirmDialog = defineAsyncComponent(() => import('../components/ConfirmDialog.vue'))
const room = useRoomStore()
const game = computed(() => room.view?.game ?? null)
const isSolo = computed(() => room.view?.mode === 'solo')
const player = computed(() => room.me)
const reveal = ref(false)
const confirmLeave = ref(false)
const copied = ref(false)
const visibleMove = ref(false)
const dealing = ref(false)
const dealSequence = ref(0)
let dealTimer: ReturnType<typeof setTimeout> | undefined
const dealCards = computed(() => {
  const active = game.value?.players.filter(p => p.chips > 0 || p.invested > 0).map(p => p.id) ?? []
  const dealer = game.value?.dealer ?? 0
  const ordered = [...active.filter(id => id > dealer), ...active.filter(id => id <= dealer)]
  return [...ordered, ...ordered]
})
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
const totalPot = computed(() => game.value ? pot(game.value as Game) : 0)
const myTurn = computed(() => game.value?.turn === room.view?.me && game.value?.street !== 'showdown' && room.connected)
const ranking = computed(() => [...(game.value?.players ?? [])].sort((a, b) => b.chips - a.chips))
const winners = computed(() => game.value?.players.filter(p => game.value!.awards.some(a => a.playerId === p.id && !a.description.startsWith('退回'))) ?? [])
const moveTone = (label: string) => label === '全下' ? 'all-in' : label === '过牌' ? 'check' : label === '弃牌' ? 'fold' : label === '跟注' ? 'call' : 'raise'
const moveIcon = computed(() => room.view?.lastMove?.label === '全下' ? Flame : room.view?.lastMove?.label === '过牌' ? CheckCheck : room.view?.lastMove?.label === '弃牌' ? Flag : Coins)
const fmt = (value: number) => value.toLocaleString('en-US')
function seatPosition(index: number, total: number) {
  const angle = Math.PI / 2 + index / total * 2 * Math.PI
  return { '--seat-x': `${50 + 44 * Math.cos(angle)}%`, '--seat-y': `${50 + 43 * Math.sin(angle)}%` }
}
watch(() => game.value?.round, () => {
  reveal.value = false
  clearTimeout(dealTimer)
  dealing.value = game.value?.street === 'preflop' && !matchMedia('(prefers-reduced-motion: reduce)').matches
  dealSequence.value++
  if (dealing.value) dealTimer = setTimeout(() => { dealing.value = false }, dealCards.value.length * 55 + 450)
}, { immediate: true })
watch(() => room.view?.lastMove?.sequence, sequence => {
  clearTimeout(feedbackTimer)
  visibleMove.value = !!sequence
  if (sequence) feedbackTimer = setTimeout(() => { visibleMove.value = false }, 2200)
})
onUnmounted(() => { clearTimeout(feedbackTimer); clearTimeout(dealTimer) })
async function copyCode() {
  if (!room.view) return
  try { await navigator.clipboard.writeText(room.view.code); copied.value = true; setTimeout(() => { copied.value = false }, 2000) }
  catch { room.error = `复制失败，房间码：${room.view.code}` }
}
function exit() { confirmLeave.value = false; room.leave() }
</script>

<template>
  <div v-if="room.view && game" class="table-page">
    <AppHeader at-table :solo="isSolo" :connected="room.connected" @leave="confirmLeave = true" />
    <main>
      <div class="table-topline"><div class="table-identity"><Spade :size="14" fill="currentColor" /><span>{{ isSolo ? '单机牌桌' : `房间 ${room.view.code}` }}</span><button v-if="!isSolo" class="icon-button copy-code" :title="copied ? '已复制' : '复制房间码'" @click="copyCode"><component :is="copied ? CheckCheck : Copy" :size="14" /></button><i></i><span class="blind-info">盲注 {{ game.settings.smallBlind }} / {{ game.settings.smallBlind * 2 }}</span></div><div class="round-count">第 <b>{{ game.round.toString().padStart(2, '0') }}</b><span>/ {{ game.settings.rounds.toString().padStart(2, '0') }} 轮</span></div></div>
      <div v-if="room.error" class="table-alert" role="alert"><span>{{ room.error }}</span><button class="icon-button" title="关闭错误提示" @click="room.error = ''"><X :size="16" /></button></div>
      <div v-if="room.notice" class="table-alert" role="status"><WifiOff :size="17" /><span>{{ room.notice }}</span><button v-if="!room.connected && room.saved" class="text-button" :disabled="room.busy" @click="room.resume()">重新连接</button></div>

      <section class="table-stage" aria-label="德州扑克牌桌">
        <div class="poker-scene" :class="{ dealing }">
          <div class="table-rim"><div class="felt"><div class="felt-outline"></div><div class="table-center"><div class="felt-wordmark"><Spade :size="14" fill="currentColor" />TABLEMATES</div><div class="pot-label">{{ game.street === 'showdown' ? '本轮底池' : '底池筹码' }}</div><div class="pot-display"><PokerChips :amount="totalPot" /><div :key="totalPot" class="pot-amount">{{ fmt(totalPot) }}</div></div><div class="community-cards"><PlayingCard v-for="i in 5" :key="i" :card="game.board[i - 1]" :empty="!game.board[i - 1]" animate :deal-delay="(i - 1) * 80" /></div><div class="street-label"><span>{{ streetNames[game.street] }}</span><template v-if="game.street !== 'showdown'">{{ game.players[game.turn]?.name }} 行动中</template><template v-else>{{ winners.map(p => p.name).join('、') }} 获胜</template></div></div></div></div>
          <div v-for="(seat, i) in room.view.seats" :key="i" class="player-seat" :class="{ 'seat-active': game.turn === i, 'seat-folded': game.players[i]!.folded, 'seat-self': i === room.view.me, 'seat-upper': Math.sin(Math.PI / 2 + i / room.view.seats.length * 2 * Math.PI) < -.2, 'seat-winner': game.street === 'showdown' && winners.some(p => p.id === i) }" :style="seatPosition(i, room.view.seats.length)">
            <div v-if="game.street === 'showdown' && !game.players[i]!.folded" class="seat-cards"><PlayingCard v-for="card in game.players[i]!.cards" :key="card" :card="card" small /></div><div v-else-if="!game.players[i]!.folded && i !== room.view.me" class="seat-cards"><PlayingCard v-for="j in 2" :key="j" hidden small /></div>
            <span v-if="game.dealer === i" class="dealer-badge" title="庄家">D</span><div class="avatar" :class="`avatar-${i % 4}`"><Trophy v-if="game.street === 'showdown' && winners.some(p => p.id === i)" :size="21" /><span v-else>{{ seat.bot ? `B${i}` : seat.name.slice(0, 1) }}</span><span v-if="!isSolo" class="online-dot" :class="{ online: seat.online }"></span></div><div class="seat-details"><span class="seat-name">{{ seat.name }}<small v-if="i === room.view.me">你</small></span><b class="seat-chips"><PokerChips :amount="game.players[i]!.chips" small />{{ fmt(game.players[i]!.chips) }}</b></div><span v-if="game.players[i]!.lastAction" class="seat-action" :class="`tone-${moveTone(game.players[i]!.lastAction)}`">{{ game.players[i]!.lastAction }}<template v-if="game.players[i]!.bet > 0"> {{ fmt(game.players[i]!.bet) }}</template></span>
          </div>
          <div v-if="dealing" :key="dealSequence" class="deal-layer" aria-hidden="true"><div class="deck-origin"><PlayingCard hidden small /></div><div v-for="(seat, index) in dealCards" :key="index" class="flying-card" :style="{ ...seatPosition(seat, room.view.seats.length), animationDelay: `${index * 55}ms` }"><PlayingCard hidden small /></div></div>
          <Transition name="move"><div v-if="visibleMove && room.view.lastMove" :key="room.view.lastMove.sequence" class="move-feedback" :class="`tone-${moveTone(room.view.lastMove.label)}`" role="status"><component :is="moveIcon" :size="21" /><span><small>{{ game.players[room.view.lastMove.playerId]?.name }}</small><b>{{ room.view.lastMove.label === '全下' ? 'ALL IN' : room.view.lastMove.label }}</b></span><strong v-if="room.view.lastMove.amount">{{ fmt(room.view.lastMove.amount) }}</strong></div></Transition>
        </div>
        <div class="stage-caption"><span>NO LIMIT TEXAS HOLD'EM</span><span>{{ game.street === 'showdown' ? 'NICE HAND.' : myTurn ? 'YOUR MOVE.' : 'GOOD CARDS. BETTER COMPANY.' }}</span></div>
      </section>

      <section v-if="game.street !== 'showdown'" class="action-dock" :class="{ 'is-your-turn': myTurn }">
        <div class="dock-inner"><div class="own-hand"><div class="own-cards"><PlayingCard v-for="(card, i) in player?.cards ?? []" :key="i" :card="card" :hidden="!reveal" /></div><div class="hand-details"><span class="eyebrow">YOUR HAND</span><h2>我的底牌</h2><button class="hand-toggle" @click="reveal = !reveal"><component :is="reveal ? EyeOff : Eye" :size="14" />{{ reveal ? '收起底牌' : '查看底牌' }}</button></div><div class="my-stack"><PokerChips :amount="player?.chips ?? 0" small /><div><span>剩余筹码</span><b>{{ fmt(player?.chips ?? 0) }}</b></div></div></div><PokerActions /></div>
      </section>

      <section v-else class="settlement"><div class="settlement-heading"><div><span class="eyebrow">{{ game.finished ? 'SESSION COMPLETE' : 'NICE HAND' }}</span><h2><Trophy :size="22" />{{ game.finished ? '今晚的筹码榜' : '本轮结算' }}</h2></div><button v-if="room.view.host && !game.finished" class="button primary" :disabled="!room.connected" @click="room.next()">开始第 {{ game.round + 1 }} 轮<ArrowRight :size="18" /></button><button v-else-if="game.finished" class="button primary" @click="confirmLeave = true">{{ isSolo ? '结束单机对局' : '结束房间' }}<ArrowRight :size="18" /></button><span v-else class="waiting-next">等待房主开始下一轮</span></div><div class="standings"><div v-for="(p, i) in ranking" :key="p.id" class="standing-row"><span class="rank-number"><Trophy v-if="i === 0" :size="16" /><template v-else>{{ i + 1 }}</template></span><b>{{ p.name }}<small v-if="p.id === room.view.me"> (你)</small></b><div class="ranking-hand"><PlayingCard v-for="card in p.folded ? [] : p.cards" :key="card" :card="card" small /></div><strong>{{ fmt(p.chips) }}</strong><span :class="p.chips >= game.settings.chips ? 'profit' : 'loss'">{{ p.chips >= game.settings.chips ? '+' : '' }}{{ fmt(p.chips - game.settings.chips) }}</span></div></div><p v-if="game.finished" class="finish-note"><CheckCheck :size="15" />本局已结束，临时缓存已清除</p></section>
    </main>
    <ConfirmDialog v-if="confirmLeave" :host="room.view.host" :solo="isSolo" @close="confirmLeave = false" @confirm="exit" />
  </div>
</template>

<style scoped>
.table-page { --stage: #17251f; --dock: #1a2a22; --soft: #9bad9d; min-height: 100dvh; color: #dfe7da; background: var(--stage); }
:deep(.site-header) { height: 56px; background: #17251f; border-bottom-color: #314238; }
:deep(.brand-symbol) { width: 30px; height: 32px; border-color: #52634d; color: #cbd7b9; }
:deep(.brand-name) { font-size: 19px; color: #e3e9dc; }
:deep(.brand-name small) { color: #8fa38c; font-size: 7px; }
:deep(.header-caption),:deep(.status),:deep(.leave-table) { color: #9db19d; }
:deep(.leave-table:hover) { background: #293d30; color: #edf1e3; }
.table-topline { height: 34px; display: flex; align-items: center; justify-content: space-between; padding-inline: 4%; gap: 12px; }
.table-identity { display: flex; align-items: center; gap: 8px; color: #a7b99f; font-size: 10px; }
.table-identity>svg { color: #b1c292; }.table-identity i { width: 1px; height: 10px; background: #43533f; margin-inline: 5px; }
.blind-info { color: #849880; font-size: 10px; }.copy-code { width: 22px; height: 22px; }
.round-count { color: #a8b599; font-size: 10px; white-space: nowrap; }.round-count b { font: 500 17px var(--numbers); color: #e3d9a9; margin-inline: 4px; }.round-count>span { color: #7f9379; }
.table-alert { display: flex; align-items: center; gap: 10px; padding: 8px 4%; font-size: 12px; color: #f1d59b; background: #4b3d25; }.table-alert>span { flex: 1; }
.table-stage { padding: 0 3%; overflow: hidden; background: var(--stage); }
.poker-scene { height: max(440px, calc(100svh - 190px)); position: relative; max-width: 1320px; margin: auto; }
.table-rim { position: absolute; inset: 56px 30px 54px; padding: 15px; border-radius: 45%; background: #101c16; border: 1px solid #586147; box-shadow: 0 16px 30px #050d094d, inset 0 3px 3px #68755b55, inset 0 -6px 4px #050f0a; }
.felt { position: relative; height: 100%; border-radius: inherit; background: #205b48 url('../assets/felt.svg'); box-shadow: inset 0 10px 20px #092c22b3, inset 0 -3px 7px #3a7b5e33; overflow: hidden; }
.felt-outline { position: absolute; inset: 19px; border: 1px solid #a5b7864d; border-radius: inherit; }.felt-outline::after { content: ''; position: absolute; inset: 5px; border: 1px solid #abc29312; border-radius: inherit; }
.table-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.felt-wordmark { display: flex; align-items: center; gap: 6px; font-size: 9px; color: #b6c6a04a; margin-bottom: 17px; }
.pot-label { font-size: 9px; color: #b4c69d; }
.pot-display { display: flex; align-items: center; gap: 13px; margin-top: 6px; min-height: 46px; }
.pot-amount { font: 500 36px var(--numbers); color: #f0e6c5; animation: pot-tick .22s ease-out; }
.community-cards { display: flex; gap: 9px; margin: 19px 0 16px; perspective: 800px; }
.community-cards :deep(.playing-card) { width: 72px; height: 101px; border-radius: 5px; }
.street-label { display: flex; align-items: center; gap: 10px; color: #a4b991; font-size: 10px; max-width: 80%; }
.street-label>span { padding-right: 10px; border-right: 1px solid #8ea77e55; color: #cfdbb8; white-space: nowrap; }
.stage-caption { display: flex; justify-content: space-between; max-width: 1320px; margin: auto; height: 16px; padding-inline: 10px; font-size: 7px; color: #617a63; }
.player-seat { position: absolute; left: clamp(58px, var(--seat-x), calc(100% - 58px)); top: clamp(56px, var(--seat-y), calc(100% - 54px)); transform: translate(-50%, -50%); width: 116px; height: 108px; display: flex; flex-direction: column; align-items: center; z-index: 2; }
.avatar { width: 40px; height: 40px; border: 3px solid var(--stage); border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-size: 15px; font-weight: 550; position: relative; box-shadow: 0 3px 8px #0004; }
.avatar-0 { color: #345a40; background: #d0dfc0; }.avatar-1 { color: #805762; background: #e0bdc3; }.avatar-2 { color: #466c7d; background: #bfd5dc; }.avatar-3 { color: #85723f; background: #e0c991; }
.seat-details { margin-top: 3px; width: 108px; height: 45px; padding: 4px 6px; background: #182c22eb; border: 1px solid #4b6148; border-radius: 5px; text-align: center; flex-shrink: 0; }
.seat-name { display: block; font-size: 11px; color: #cedac8; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }.seat-name small { margin-left: 4px; font-size: 8px; color: #9ab17f; }
.seat-chips { display: flex; align-items: center; justify-content: center; gap: 5px; margin-top: 2px; color: #e9ddb0; font: 500 14px var(--numbers); height: 21px; }
.seat-chips :deep(.chip-stacks) { --size: 12px; height: 17px; }.seat-chips :deep(.poker-chip) { border-width: 1px; }.seat-chips :deep(.poker-chip b) { font-size: 4px; }
.seat-active .avatar { outline: 2px solid #d6bf7d; box-shadow: 0 0 0 5px #d6bf7d14; }.seat-active .seat-details { border-color: #ad985e; }.seat-winner .avatar { background: #dfc27d; color: #715522; outline: 2px solid #e3c987; }.seat-folded { opacity: .42; }
.dealer-badge { position: absolute; right: 24px; top: 1px; border-radius: 50%; width: 17px; height: 17px; display: grid; place-items: center; background: #e3dcc1; color: #776b40; font-size: 9px; z-index: 3; box-shadow: 0 2px 4px #0004; }
.online-dot { position: absolute; bottom: 0; right: 0; width: 8px; height: 8px; border: 2px solid var(--stage); border-radius: 50%; background: #818e7e; }.online-dot.online { background: #94c279; }
.seat-cards { position: absolute; display: flex; gap: 3px; top: -47px; }.seat-upper .seat-cards { top: 3px; left: calc(50% + 61px); }
.seat-action { max-width: 112px; margin-top: 3px; padding: 2px 7px; font-size: 9px; border-radius: 3px; line-height: 1.3; white-space: nowrap; }
.tone-call { color: #eed9a0; background: #514e32; }.tone-check { color: #bddbd0; background: #2d5149; }.tone-raise { color: #d5e3e5; background: #345663; }.tone-all-in { color: #f3c0ad; background: #743d3c; }.tone-fold { color: #b9c2b2; background: #3d4a3c; }
.move-feedback { position: absolute; left: 50%; top: 26%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 9px; padding: 7px 12px; border: 1px solid #b9c49b33; border-radius: 5px; box-shadow: 0 5px 15px #09170d66; z-index: 5; pointer-events: none; max-width: 65%; }
.move-feedback small { display: block; font-size: 8px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; max-width: 100px; }.move-feedback b { display: block; font-size: 13px; margin-top: 2px; }.move-feedback strong { font: 500 17px var(--numbers); }
.move-enter-active,.move-leave-active { transition: opacity .18s, transform .18s; }.move-enter-from,.move-leave-to { opacity: 0; transform: translate(-50%, -35%); }
.action-dock { padding: 11px 4% max(11px, env(safe-area-inset-bottom)); background: var(--dock); border-top: 1px solid #354a38; }
.action-dock.is-your-turn { border-top-color: #64704c; }
.dock-inner { max-width: 1320px; margin: auto; display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 28px; align-items: center; }
.own-hand { display: flex; align-items: center; gap: 10px; min-width: 0; }.own-cards { display: flex; gap: 3px; }.own-cards :deep(.playing-card) { width: 39px; height: 55px; border-radius: 4px; }.own-cards :deep(.back-symbol) { font-size: 20px; inset: 4px; }.own-cards :deep(.corner) { font-size: 12px; top: 4px; left: 4px; }.own-cards :deep(.corner span) { font-size: 9px; }.own-cards :deep(.bottom) { top: auto; left: auto; right: 4px; bottom: 4px; }.own-cards :deep(.center-suit) { font-size: 21px; }
.eyebrow { font-size: 7px; color: #7d9278; }.hand-details { flex-shrink: 0; }.hand-details h2 { font-size: 12px; font-weight: 500; margin: 3px 0 7px; color: #d9e2cd; }
.hand-toggle { border: 0; background: none; padding: 0; display: flex; align-items: center; gap: 4px; color: #9caf8b; font-size: 9px; }.hand-toggle:hover { color: #edf1d9; }
.my-stack { margin-left: auto; display: flex; align-items: center; gap: 6px; }.my-stack span { font-size: 8px; color: #899c80; }.my-stack b { display: block; margin-top: 3px; font: 500 17px var(--numbers); color: #d3dcb6; }
.settlement { max-width: 1040px; margin: auto; padding: 22px 4% 30px; }.settlement-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }.settlement-heading h2 { display: flex; align-items: center; gap: 8px; font-size: 19px; font-weight: 500; margin: 7px 0 0; }.settlement-heading h2 svg { color: #c9b277; }.settlement-heading .button { background: #354e3d; color: #e1e8d1; border-color: #667954; }
.standings { display: grid; grid-template-columns: 1fr 1fr; column-gap: 30px; }.standing-row { display: grid; grid-template-columns: 20px minmax(60px, 1fr) auto 65px 45px; gap: 8px; align-items: center; padding: 12px 0; border-bottom: 1px solid #3a4a37; min-height: 65px; }.rank-number { font-size: 12px; color: #c4ae77; }.standing-row>b { font-size: 12px; font-weight: 500; overflow-wrap: anywhere; }.standing-row small { font-size: 9px; color: #9aaa85; }.ranking-hand { display: flex; gap: 3px; }.standing-row>strong { text-align: right; font: 500 16px var(--numbers); }.standing-row>span:last-child { text-align: right; font-size: 10px; }.profit { color: #a8c28d; }.loss { color: #d19282; }.finish-note { margin: 20px 0 0; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 11px; color: #8b9f7e; }.waiting-next { font-size: 11px; color: #9daf8c; }
.deal-layer { position: absolute; inset: 0; z-index: 6; pointer-events: none; }
.deck-origin { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%) rotate(-12deg); box-shadow: 3px 3px 0 #acb7a7, 5px 5px 0 #16271c; border-radius: 3px; }
.flying-card { position: absolute; left: 50%; top: 40%; opacity: 0; animation: deal-flight .38s cubic-bezier(.2,.65,.3,1) both; }
.dealing .seat-cards { visibility: hidden; }
@keyframes deal-flight { 0% { left: 50%; top: 40%; transform: translate(-50%, -50%) rotate(-12deg) scale(.8); opacity: 1; } 80% { opacity: 1; } 100% { left: var(--seat-x); top: var(--seat-y); transform: translate(-50%, -50%) rotate(7deg); opacity: 0; } }
@keyframes pot-tick { from { opacity: .5; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
@media(max-width:1100px) { .dock-inner { grid-template-columns: 235px minmax(0, 1fr); gap: 18px; }.own-cards :deep(.playing-card) { width: 32px; height: 46px; }.hand-details .eyebrow { display: none; }.my-stack :deep(.chip-stacks) { display: none; }.my-stack b { font-size: 15px; } }
@media(max-width:800px) { .poker-scene { height: max(390px, calc(100svh - 260px)); }.dock-inner { grid-template-columns: 1fr; gap: 8px; }.own-hand { max-width: none; }.own-cards :deep(.playing-card) { width: 29px; height: 41px; }.hand-details h2 { margin: 0 0 4px; }.my-stack :deep(.chip-stacks) { display: inline-flex; }.standings { grid-template-columns: 1fr; }.table-rim { inset-inline: 12px; }.community-cards :deep(.playing-card) { width: 60px; height: 85px; } }
@media(max-width:600px) {
  :deep(.site-header) { height: 48px; padding-inline: 15px; }:deep(.brand-symbol) { height: 29px; width: 28px; }:deep(.brand-name) { font-size: 17px; }:deep(.header-right) { gap: 8px; }:deep(.status) { font-size: 10px; }
  .table-topline { height: 32px; padding-inline: 15px; }.table-identity { gap: 5px; font-size: 9px; }.blind-info { font-size: 8px; }.round-count { font-size: 9px; }.round-count b { font-size: 15px; }
  .table-stage { padding-inline: 9px; }.poker-scene { height: max(320px, calc(100svh - 228px)); }.stage-caption { display: none; }
  .table-rim { inset: 44px 0 43px; padding: 10px; border-radius: 43%; }.felt-outline { inset: 12px; }.felt-wordmark { display: none; }
  .pot-label { font-size: 8px; }.pot-display { margin-top: 4px; gap: 9px; min-height: 35px; }.pot-amount { font-size: 28px; }
  .community-cards { gap: 5px; margin: 14px 0 12px; }.community-cards :deep(.playing-card) { width: min(38px, calc((100vw - 200px) / 5)); height: 62px; border-radius: 4px; }
  .community-cards :deep(.corner) { font-size: 13px; left: 4px; top: 4px; }.community-cards :deep(.corner span) { font-size: 10px; }.community-cards :deep(.bottom) { display: none; }.community-cards :deep(.center-suit) { font-size: 20px; align-items: end; justify-content: end; padding: 5px; }
  .street-label { font-size: 9px; gap: 7px; max-width: 90%; }.street-label>span { padding-right: 7px; }
  .player-seat { width: 86px; height: 88px; left: clamp(39px, var(--seat-x), calc(100% - 39px)); top: clamp(46px, var(--seat-y), calc(100% - 43px)); }
  .avatar { width: 32px; height: 32px; border-width: 2px; font-size: 12px; }.seat-details { width: 78px; height: 37px; padding: 3px 4px; }.seat-name { font-size: 9px; }.seat-name small { font-size: 7px; }.seat-chips { height: 17px; font-size: 12px; gap: 3px; margin-top: 1px; }.seat-chips :deep(.chip-stacks) { --size: 10px; height: 14px; }.seat-chips :deep(.chip-column:nth-child(2)) { display: none; }
  .seat-action { font-size: 8px; padding: 1px 5px; margin-top: 2px; }.dealer-badge { right: 14px; top: 0; width: 15px; height: 15px; font-size: 8px; }.seat-cards { display: none; }
  .move-feedback { top: 27%; max-width: 70%; padding: 6px 10px; }.move-feedback>svg { width: 17px; }.move-feedback b { font-size: 12px; }.move-feedback strong { font-size: 15px; }
  .action-dock { padding: 8px 12px max(8px, env(safe-area-inset-bottom)); }.own-hand { gap: 8px; }.own-cards :deep(.playing-card) { width: 28px; height: 40px; border-width: 2px; }.own-cards :deep(.back-symbol) { font-size: 17px; inset: 3px; }.own-cards :deep(.corner) { font-size: 10px; left: 3px; top: 3px; }.own-cards :deep(.corner span) { font-size: 7px; }.own-cards :deep(.bottom) { top: auto; left: auto; bottom: 3px; right: 3px; }.own-cards :deep(.center-suit) { font-size: 16px; }
  .hand-details h2 { font-size: 10px; }.hand-toggle { font-size: 9px; }.my-stack span { font-size: 8px; }.my-stack b { margin-top: 2px; font-size: 16px; }
  .settlement { padding: 18px 16px 25px; }.settlement-heading h2 { font-size: 16px; }.settlement-heading>.button { font-size: 10px; height: 38px; padding-inline: 9px; }.standing-row { grid-template-columns: 16px minmax(55px, 1fr) auto 55px 40px; gap: 6px; }.standing-row>b { font-size: 11px; }.standing-row>strong { font-size: 14px; }
}
@media(max-width:600px) and (max-height:660px) { .community-cards { margin-block: 9px; }.community-cards :deep(.playing-card) { height: 52px; }.street-label { font-size: 8px; }.pot-amount { font-size: 24px; }.player-seat { height: 80px; }.avatar { width: 27px; height: 27px; }.seat-details { height: 35px; }.move-feedback { top: 25%; } }
@media(prefers-reduced-motion:reduce) { .flying-card,.pot-amount { animation: none; }.deal-layer { display: none; }.dealing .seat-cards { visibility: visible; }.move-enter-active,.move-leave-active { transition: none; } }
</style>

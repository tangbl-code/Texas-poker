<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { ArrowRight, ArrowUpRight, Bot, Check, CheckCheck, CircleHelp, Copy, Crown, Eye, EyeOff, Flag, Layers3, Link, LoaderCircle, LogOut, Minus, Plus, RotateCcw, ShieldCheck, Spade, Trophy, Users, Wifi, WifiOff, X } from 'lucide-vue-next'
import PlayingCard from '../components/PlayingCard.vue'
import { useRoomStore } from '../stores/room'
import { pot, raiseAllowed, streetNames, type Game } from '../game/engine'

const ConfirmDialog = defineAsyncComponent(() => import('../components/ConfirmDialog.vue'))
const room = useRoomStore()
const mode = ref<'solo' | 'host' | 'join'>(new URLSearchParams(location.search).has('room') ? 'join' : 'solo')
const name = ref('')
const code = ref(new URLSearchParams(location.search).get('room') ?? '')
const count = ref(4)
const chips = ref(1000)
const rounds = ref(10)
const blind = ref(10)
const reveal = ref(false)
const confirmLeave = ref(false)
const copied = ref(false)
const copyKind = ref('')
const raiseTo = ref(0)
const showInfo = ref(false)
const formError = ref('')
const game = computed(() => room.view?.game ?? null)
const isSolo = computed(() => room.view ? room.view.mode === 'solo' : mode.value === 'solo')
const player = computed(() => room.me)
const myTurn = computed(() => game.value && game.value.turn === room.view?.me && game.value.street !== 'showdown' && room.connected)
const toCall = computed(() => Math.min(player.value?.chips ?? 0, Math.max(0, (game.value?.currentBet ?? 0) - (player.value?.bet ?? 0))))
const maxBet = computed(() => (player.value?.chips ?? 0) + (player.value?.bet ?? 0))
const minBet = computed(() => Math.min(maxBet.value, (game.value?.currentBet ?? 0) + (game.value?.minRaise ?? 0)))
const canRaise = computed(() => !!game.value && raiseAllowed(game.value as Game) && maxBet.value > game.value.currentBet)
const totalPot = computed(() => game.value ? pot(game.value as Game) : 0)
const seats = computed(() => room.view ? room.view.seats : Array.from({ length: count.value }, (_, i) => ({ name: i === 0 ? name.value || '你的位置' : `等待玩家`, online: i === 0 })))
const tableTitle = computed(() => room.view?.ended ? '牌局已结束' : game.value?.finished ? '下次再同桌' : game.value ? streetNames[game.value.street] : '好朋友，同一桌')
const awards = computed(() => {
  if (!game.value) return []
  return game.value.players.map(p => ({ ...p, won: game.value!.awards.filter(a => a.playerId === p.id && !a.description.startsWith('退回')).reduce((n, a) => n + a.amount, 0), description: game.value!.awards.find(a => a.playerId === p.id && !a.description.startsWith('退回'))?.description })).filter(p => p.won > 0)
})
const ranking = computed(() => [...(game.value?.players ?? [])].sort((a, b) => b.chips - a.chips))
const fmt = (n: number) => n.toLocaleString('en-US')
watch(() => [game.value?.turn, game.value?.street, game.value?.currentBet], () => { raiseTo.value = minBet.value })
watch(() => game.value?.round, () => { reveal.value = false })

async function submit() {
  formError.value = ''
  if (mode.value !== 'solo' && !name.value.trim()) { formError.value = '先给自己取个昵称'; return }
  if (mode.value === 'solo') room.solo(name.value, { chips: chips.value, rounds: rounds.value, smallBlind: blind.value }, count.value)
  else if (mode.value === 'host') await room.host(name.value, { chips: chips.value, rounds: rounds.value, smallBlind: blind.value }, count.value)
  else await room.join(name.value, code.value)
}
async function copy(invite = false) {
  if (!room.view) return
  const url = new URL(location.href)
  url.search = ''
  url.searchParams.set('room', room.view.code)
  url.hash = '/'
  const text = invite ? url.toString() : room.view.code
  try { await navigator.clipboard.writeText(text); copied.value = true; copyKind.value = invite ? 'link' : 'code'; setTimeout(() => { copied.value = false }, 2200) }
  catch { room.error = `复制失败，请手动复制房间码：${room.view.code}` }
}
function seatPosition(index: number, total: number) {
  // Seats trace the outside of the felt, starting at the near edge.
  const angle = Math.PI / 2 + (index / total) * 2 * Math.PI
  return { '--seat-x': `${50 + 43 * Math.cos(angle)}%`, '--seat-y': `${50 + 44 * Math.sin(angle)}%` }
}
function exit() { confirmLeave.value = false; room.leave(); reveal.value = false }
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#/" aria-label="同桌首页"><span class="brand-mark"><Spade :size="24" fill="currentColor" /></span><span class="brand-name">同桌<span>TABLEMATES</span></span></a>
      <div class="header-center"><span class="tiny-dot"></span> FRIENDS AT THE TABLE</div>
      <div class="header-actions">
        <span class="connection-label" :class="{ offline: room.view && !room.connected }"><component :is="isSolo ? Bot : room.view && !room.connected ? WifiOff : Wifi" :size="15" />{{ isSolo ? '单机模式' : room.view ? room.connected ? '已连接' : '连接断开' : '面对面 · 线上牌桌' }}</span>
        <button class="icon-button" title="连接信息" @click="showInfo = !showInfo"><CircleHelp :size="19" /></button>
      </div>
    </header>

    <main>
      <div class="page-heading">
        <div><div class="eyebrow">{{ isSolo ? 'SOLO TABLE' : 'THE POKER ROOM' }} <span>/</span> NO. {{ room.view?.code || '001' }}</div><h1>{{ room.view ? '今晚，尽兴同桌。' : isSolo ? '好牌，随时开一局。' : '人齐了，就开一桌。' }}</h1></div>
        <div v-if="room.view && !room.view.ended" class="room-header-actions"><template v-if="!isSolo"><span class="room-code-label">房间码 <b>{{ room.view.code }}</b></span><button class="icon-button" title="复制房间码" @click="copy()"><Check v-if="copied && copyKind === 'code'" :size="18" /><Copy v-else :size="18" /></button></template><button class="icon-button leave-button" :title="isSolo ? '结束单机对局' : room.view.host ? '结束房间' : '离开房间'" @click="confirmLeave = true"><LogOut :size="18" /></button></div>
        <div v-else class="heading-tag"><Spade :size="14" /> TEXAS HOLD'EM</div>
      </div>

      <div v-if="showInfo" class="information" role="status"><ShieldCheck :size="19" /><span>{{ isSolo ? '当前为本机对局，不连接联机服务。进行中的牌局保存在此浏览器，结束后清除。' : '玩家通过加密直连同步牌局；房主需保持在线。当前房间可在本机恢复，结束后清除数据。公共连接服务在部分网络下可能无法连通，可更换网络重试。' }}</span><button class="icon-button" title="关闭连接信息" @click="showInfo = false"><X :size="17" /></button></div>
      <div v-if="room.error || formError" class="alert error" role="alert"><span>{{ room.error || formError }}</span><button class="icon-button" title="关闭错误提示" @click="room.error = ''; formError = ''"><X :size="17" /></button></div>
      <div v-if="room.notice && !room.view?.ended" class="alert" role="status"><span>{{ room.notice }}</span><button v-if="!room.connected && room.saved" class="text-button" :disabled="room.busy" @click="room.resume()">重新连接</button></div>

      <div class="workspace" :class="{ 'no-room': !room.view }">
        <section class="table-area" :class="{ 'is-playing': !!game }">
          <div class="table-toolbar"><span class="table-name"><span class="live-dot" :class="{ active: !!game }"></span>{{ game ? '正在对局' : room.view?.ended ? '已结束' : '等待开局' }}</span><span v-if="game" class="round-count">第 <b>{{ game.round.toString().padStart(2, '0') }}</b> / {{ game.settings.rounds.toString().padStart(2, '0') }} 轮</span><span v-else class="table-capacity"><Users :size="14" /> {{ room.view ? room.view.seats.length : 0 }} / {{ room.view?.capacity ?? count }} 人</span></div>

          <div class="poker-scene">
            <div class="table-rim"><div class="felt">
              <div class="felt-outline"></div>
              <div class="table-center">
                <div class="felt-wordmark"><Spade :size="14" fill="currentColor" /> TABLEMATES</div>
                <template v-if="game">
                  <div class="pot-label">{{ game.street === 'showdown' ? '本轮底池' : '底池筹码' }}</div><div class="pot-amount"><span class="chip-mini"></span>{{ fmt(totalPot) }}</div>
                  <div class="community-cards"><PlayingCard v-for="i in 5" :key="i" :card="game.board[i - 1]" :empty="!game.board[i - 1]" /></div>
                  <div class="street-label">{{ tableTitle }} <span v-if="game.street !== 'showdown'">· {{ game.players[game.turn]?.name }} 行动中</span></div>
                </template>
                <template v-else>
                  <div class="idle-cards"><PlayingCard card="As" /><PlayingCard card="Ah" /></div>
                  <h2>{{ tableTitle }}</h2><span class="felt-subtitle">{{ room.view?.ended ? '这桌的筹码已清零' : room.view ? '座位留好了，等你入席' : 'THE BEST HAND IS A TABLE OF FRIENDS' }}</span>
                </template>
              </div>
            </div></div>
            <div v-for="(seat, i) in seats" :key="i" class="player-seat" :class="{ 'seat-empty': !room.view && i > 0, 'seat-active': game?.turn === i, 'seat-folded': game?.players[i]?.folded, 'seat-self': i === (room.view?.me ?? 0), 'seat-upper': Math.sin(Math.PI / 2 + i / seats.length * 2 * Math.PI) < -0.2 }" :style="seatPosition(i, seats.length)">
              <div v-if="game && game.players[i]!.cards.length && game.street === 'showdown'" class="seat-cards"><PlayingCard v-for="card in game.players[i]!.cards" :key="card" :card="card" small /></div>
              <div v-else-if="game && !game.players[i]!.folded && i !== room.view?.me" class="seat-cards"><PlayingCard v-for="j in 2" :key="j" hidden small /></div>
              <span v-if="game?.dealer === i" class="dealer-badge" title="庄家">D</span>
              <div class="avatar" :class="`avatar-${i % 4}`"><Bot v-if="isSolo && i > 0" :size="21" /><Plus v-else-if="!room.view && i > 0" :size="21" /><span v-else>{{ seat.name.slice(0, 1) }}</span><span v-if="room.view && !isSolo" class="online-dot" :class="{ online: seat.online }"></span></div>
              <div class="seat-details"><span class="seat-name">{{ seat.name }}<span v-if="i === (room.view?.me ?? 0)" class="you-label">你</span></span><span class="seat-chips">{{ game ? fmt(game.players[i]!.chips) : room.view ? seat.online ? i === 0 ? '房主' : '已入座' : '离线' : i === 0 ? '房主' : '空位' }}</span></div>
              <span v-if="game?.players[i]?.lastAction" class="seat-action">{{ game.players[i]!.lastAction }}<template v-if="game.players[i]!.bet > 0"> {{ fmt(game.players[i]!.bet) }}</template></span>
            </div>
          </div>

          <div class="table-bottom"><div><span class="chip-stack"><i></i><i></i><i></i></span><span>无限注德州扑克</span></div><span>盲注 {{ fmt(game?.settings.smallBlind ?? room.view?.settings.smallBlind ?? blind) }} / {{ fmt((game?.settings.smallBlind ?? room.view?.settings.smallBlind ?? blind) * 2) }}</span></div>

          <section v-if="game && game.street !== 'showdown'" class="hand-bar">
            <div class="own-hand"><div class="own-cards"><PlayingCard v-for="(card, i) in player?.cards ?? []" :key="i" :card="card" :hidden="!reveal" /></div><div><span class="section-eyebrow">YOUR HAND</span><h3>我的底牌</h3><button class="text-button hand-toggle" @click="reveal = !reveal"><component :is="reveal ? EyeOff : Eye" :size="15" />{{ reveal ? '收起底牌' : '查看底牌' }}</button></div></div>
            <div class="hand-status"><span v-if="player?.folded">本轮已弃牌</span><span v-else-if="player?.chips === 0">已全下，等待结算</span><span v-else-if="myTurn" class="your-turn"><span class="live-dot active"></span> 轮到你了</span><span v-else>等待 {{ game.players[game.turn]?.name }} 行动</span><b>{{ fmt(player?.chips ?? 0) }} <small>筹码</small></b></div>
          </section>
          <section v-else-if="game?.street === 'showdown'" class="results-band">
            <Trophy :size="27" /><div><span class="section-eyebrow">{{ game.finished ? 'SESSION COMPLETE' : 'NICE HAND' }}</span><h3>{{ awards.map(a => a.name).join('、') }} 赢得本轮</h3><p v-for="award in awards" :key="award.id">{{ award.description }} <b>+{{ fmt(award.won) }}</b></p></div>
          </section>
          <div v-else class="table-note"><ShieldCheck :size="15" /><span>只留此刻，不留战绩。</span><span class="note-right">GOOD CARDS. BETTER COMPANY.</span></div>
        </section>

        <aside class="control-panel">
          <template v-if="!room.view">
            <div class="panel-heading"><span class="section-eyebrow">TAKE A SEAT</span><h2>今晚的牌局</h2></div>
            <div class="segmented" aria-label="对局模式"><button :class="{ selected: mode === 'solo' }" :aria-pressed="mode === 'solo'" :disabled="room.busy" @click="mode = 'solo'">单机模式</button><button :class="{ selected: mode === 'host' }" :aria-pressed="mode === 'host'" :disabled="room.busy" @click="mode = 'host'">创建房间</button><button :class="{ selected: mode === 'join' }" :aria-pressed="mode === 'join'" :disabled="room.busy" @click="mode = 'join'">加入房间</button></div>
            <form @submit.prevent="submit">
              <label class="field-label" for="nickname">你的昵称</label><input id="nickname" v-model="name" autocomplete="nickname" maxlength="12" :placeholder="isSolo ? '玩家' : '怎么称呼你？'" :disabled="room.busy" :required="!isSolo" />
              <template v-if="mode === 'join'"><label class="field-label" for="room-code">房间码</label><input id="room-code" v-model="code" class="code-input" placeholder="6 位房间码" maxlength="6" required :disabled="room.busy" autocapitalize="characters" autocomplete="off" /></template>
              <template v-else>
                <div class="field-row"><label class="field-label" for="player-count">{{ isSolo ? '对局人数' : '座位人数' }}</label><span class="field-hint">{{ isSolo ? `你 + ${count - 1} 个机器人` : '2–8 人' }}</span></div><div class="stepper"><button type="button" title="减少人数" :disabled="count <= 2 || room.busy" @click="count--"><Minus :size="17" /></button><output id="player-count">{{ count }} <span>人</span></output><button type="button" title="增加人数" :disabled="count >= 8 || room.busy" @click="count++"><Plus :size="17" /></button></div>
                <label class="field-label" for="initial-chips">初始筹码 <span>每人</span></label><div class="input-with-icon"><Layers3 :size="17" /><input id="initial-chips" v-model.number="chips" type="number" min="100" max="1000000" step="1" required :disabled="room.busy" /></div><div class="preset-row"><button v-for="n in [500, 1000, 2000, 5000]" :key="n" type="button" :class="{ chosen: chips === n }" :disabled="room.busy" @click="chips = n">{{ fmt(n) }}</button></div>
                <div class="two-fields"><div><label class="field-label" for="rounds">对局轮数</label><input id="rounds" v-model.number="rounds" type="number" min="1" max="100" step="1" required :disabled="room.busy" /></div><div><label class="field-label" for="blind">小盲注</label><input id="blind" v-model.number="blind" type="number" min="1" :max="Math.floor(chips / 2)" step="1" required :disabled="room.busy" /></div></div>
                <div class="settings-summary"><span>大盲注 <b>{{ fmt(blind * 2) }}</b></span><span>总筹码 <b>{{ fmt(chips * count) }}</b></span></div>
              </template>
              <button type="submit" class="button primary full-width start-button" :disabled="room.busy"><LoaderCircle v-if="room.busy" :size="18" class="spin" /><Bot v-else-if="isSolo" :size="18" /><Spade v-else :size="17" fill="currentColor" />{{ room.busy ? '正在连接…' : isSolo ? '开始单机对局' : mode === 'host' ? '创建牌局' : '加入牌局' }}<ArrowRight v-if="!room.busy" :size="18" /></button>
            </form>
            <button v-if="room.saved" class="resume-button" :disabled="room.busy" @click="room.resume()"><RotateCcw :size="15" /> 恢复上次对局 <ArrowUpRight :size="15" /></button>
            <div class="panel-footnote"><span class="tiny-dot"></span> {{ isSolo ? '本机对局 · 无需连接房间' : mode === 'host' ? '筹码仅用于朋友间的娱乐计分' : '等你入座，一起开局' }}</div>
          </template>

          <template v-else-if="room.view.ended">
            <div class="panel-heading"><span class="section-eyebrow">UNTIL NEXT TIME</span><h2>这桌已散场</h2></div><div class="ended-icon"><Spade :size="48" /></div><p class="muted centered">房间已关闭，本局数据已清除。</p><button class="button primary full-width" @click="exit">再开一桌 <ArrowRight :size="18" /></button>
          </template>

          <template v-else-if="!game">
            <div class="panel-heading"><span class="section-eyebrow">THE GUEST LIST</span><h2>等朋友入座 <span class="count-badge">{{ room.view.seats.length }}/{{ room.view.capacity }}</span></h2></div>
            <div class="invite-code"><span>房间码</span><b>{{ room.view.code }}</b><button class="icon-button" title="复制房间码" @click="copy()"><component :is="copied && copyKind === 'code' ? Check : Copy" :size="18" /></button></div>
            <button class="button secondary full-width" @click="copy(true)"><Link :size="16" />{{ copied && copyKind === 'link' ? '邀请链接已复制' : '复制邀请链接' }}</button>
            <div class="guest-list"><div v-for="(seat, i) in room.view.seats" :key="i" class="guest-row"><span class="list-avatar" :class="`avatar-${i % 4}`">{{ seat.name.slice(0, 1) }}</span><span class="guest-name">{{ seat.name }} <small v-if="i === room.view.me">(你)</small><span>{{ i === 0 ? '房主' : seat.online ? '准备就绪' : '已断开连接' }}</span></span><Crown v-if="i === 0" :size="16" class="crown" /><button v-else-if="room.view.host" class="icon-button" :title="`移除 ${seat.name}`" @click="room.removeSeat(i)"><X :size="15" /></button><Check v-else-if="seat.online" :size="17" class="green" /></div><div v-for="i in Math.max(0, room.view.capacity - room.view.seats.length)" :key="`empty-${i}`" class="guest-row vacant"><span class="list-avatar"><Plus :size="16" /></span><span>等待朋友加入</span></div></div>
            <div class="lobby-settings"><span>初始筹码<b>{{ fmt(room.view.settings.chips) }}</b></span><span>对局轮数<b>{{ room.view.settings.rounds }} 轮</b></span></div>
            <button v-if="room.view.host" class="button primary full-width" :disabled="room.view.seats.length < 2 || room.view.seats.some(s => !s.online) || !room.connected" @click="room.start()"><Spade :size="17" fill="currentColor" /> 洗牌，开始 <ArrowRight :size="18" /></button><div v-else class="waiting-host"><LoaderCircle :size="17" class="spin" /> 等待房主开始牌局</div>
          </template>

          <template v-else-if="game.street === 'showdown'">
            <div class="panel-heading"><span class="section-eyebrow">{{ game.finished ? 'FINAL STANDINGS' : 'CHIP COUNT' }}</span><h2>{{ game.finished ? '今晚的筹码榜' : '本轮筹码' }}</h2></div>
            <div class="ranking"><div v-for="(p, i) in ranking" :key="p.id" class="ranking-row"><span class="rank-number" :class="{ first: i === 0 }"><Trophy v-if="i === 0" :size="18" /><template v-else>{{ i + 1 }}</template></span><span>{{ p.name }}<small v-if="p.id === room.view.me"> (你)</small></span><b>{{ fmt(p.chips) }}</b><small :class="p.chips >= game.settings.chips ? 'green' : 'loss'">{{ p.chips >= game.settings.chips ? '+' : '' }}{{ fmt(p.chips - game.settings.chips) }}</small><div v-if="p.cards.length && !p.folded" class="ranking-hand"><PlayingCard v-for="card in p.cards" :key="card" :card="card" small /></div></div></div>
            <div v-if="game.finished" class="finish-note"><CheckCheck :size="18" /> 本局已结束，临时缓存已清除</div>
            <button v-if="room.view.host && !game.finished" class="button primary full-width" :disabled="!room.connected" @click="room.next()">开始第 {{ game.round + 1 }} 轮 <ArrowRight :size="18" /></button><button v-else-if="game.finished" class="button primary full-width" @click="room.view.host ? confirmLeave = true : exit()">{{ isSolo ? '结束单机对局' : room.view.host ? '结束房间' : '返回首页' }}<ArrowRight :size="18" /></button><div v-else class="waiting-host"><LoaderCircle :size="17" class="spin" /> 等待房主开始下一轮</div>
          </template>

          <template v-else>
            <div class="panel-heading"><span class="section-eyebrow">{{ myTurn ? 'YOUR MOVE' : 'AT THE TABLE' }}</span><h2>{{ myTurn ? '到你行动了' : '牌局进行中' }}</h2></div>
            <div class="action-context"><span>{{ streetNames[game.street] }}</span><b>{{ myTurn ? '你的回合' : `${game.players[game.turn]?.name} 的回合` }}</b><span>当前下注 <strong>{{ fmt(game.currentBet) }}</strong></span></div>
            <template v-if="myTurn">
              <div class="call-summary"><span>{{ toCall > 0 ? '需要跟注' : '本轮无需跟注' }}</span><b>{{ fmt(toCall) }}</b></div>
              <div class="action-buttons"><button class="button fold-button" @click="room.action('fold')"><Flag :size="16" />弃牌</button><button class="button primary" @click="room.action('call')"><Check :size="17" />{{ toCall > 0 ? `跟注 ${fmt(toCall)}` : '过牌' }}</button></div>
              <div v-if="canRaise" class="raise-control"><label class="field-label" for="raise-amount">{{ game.currentBet === 0 ? '下注至' : '加注至' }}<span>本街总额</span></label><input id="raise-amount" v-model.number="raiseTo" type="number" :min="minBet" :max="maxBet" step="1" /><input v-model.number="raiseTo" aria-label="加注金额滑块" type="range" :min="minBet" :max="maxBet" step="1" /><div class="range-labels"><span>{{ fmt(minBet) }}</span><span>{{ fmt(maxBet) }}</span></div><div class="bet-presets"><button v-for="fraction in [0.5, 1]" :key="fraction" @click="raiseTo = Math.min(maxBet, Math.max(minBet, game.currentBet + Math.floor(totalPot * fraction)))">{{ fraction === 0.5 ? '½ 底池' : '底池' }}</button><button @click="raiseTo = maxBet">全下</button></div><button class="button secondary full-width" :disabled="!Number.isInteger(raiseTo) || raiseTo < minBet || raiseTo > maxBet" @click="room.action('raise', raiseTo)"><ArrowUpRight :size="18" />{{ raiseTo === maxBet ? '全下' : game.currentBet === 0 ? '下注' : '加注' }} {{ fmt(raiseTo) }}</button></div>
            </template>
            <div v-else class="waiting-state"><span class="waiting-spade"><Spade :size="35" /></span><b>{{ player?.folded ? '好牌，下一轮见' : player?.chips === 0 ? '筹码已全下' : '稍等，好牌值得等待' }}</b><span>{{ player?.folded ? '等待其他玩家完成本轮' : '等待其他玩家行动' }}</span></div>
            <div class="game-details"><span>本轮已投入<b>{{ fmt(player?.invested ?? 0) }}</b></span><span>剩余筹码<b>{{ fmt(player?.chips ?? 0) }}</b></span></div>
          </template>
        </aside>
      </div>

      <footer class="footer"><span>同桌 <span class="footer-separator">/</span> 快乐比输赢重要</span><span>为相聚而生 <Spade :size="12" fill="currentColor" /></span></footer>
    </main>
    <ConfirmDialog v-if="confirmLeave && room.view" :host="room.view.host" :solo="isSolo" @close="confirmLeave = false" @confirm="exit" />
  </div>
</template>

<style scoped>
.app-shell { min-height: 100dvh; }
.topbar { height: 84px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; padding: 0 4%; background: #fff; }
.brand { display: flex; gap: 11px; align-items: center; color: var(--ink); text-decoration: none; }
.brand-mark { display: grid; place-items: center; width: 42px; height: 45px; color: var(--green); border: 1px solid #ccd8d0; border-radius: 7px; }
.brand-name { font-weight: 750; font-size: 23px; line-height: 1; }.brand-name>span { display: block; font-size: 9px; font-weight: 600; margin-top: 7px; }
.header-center { font-size: 10px; color: #78827c; display: flex; align-items: center; gap: 10px; }
.tiny-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #94a69a; }
.header-actions { display: flex; align-items: center; gap: 17px; }.connection-label { color: var(--muted); display: flex; align-items: center; gap: 7px; font-size: 12px; }.connection-label.offline { color: #ae4b4b; }
main { max-width: 1440px; padding: 35px 4% 0; margin: auto; }.page-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; gap: 16px; }
.eyebrow { font-size: 10px; font-weight: 600; color: var(--muted); }.eyebrow>span { margin: 0 8px; color: #b9c0bc; }h1 { font-size: 28px; font-weight: 650; margin: 9px 0 0; }
.heading-tag { border: 1px solid var(--line); padding: 9px 11px; font-size: 10px; display: flex; align-items: center; gap: 7px; color: #66776c; border-radius: 4px; }
.room-header-actions { display: flex; align-items: center; gap: 6px; }.room-code-label { font-size: 12px; color: var(--muted); }.room-code-label b { font-size: 15px; color: var(--ink); margin-left: 9px; }.leave-button { margin-left: 10px; color: #ab6660; }
.workspace { display: grid; grid-template-columns: minmax(0, 1fr) 318px; gap: 32px; align-items: start; }
.table-area { min-width: 0; }.table-toolbar { display: flex; align-items: center; justify-content: space-between; height: 35px; padding: 0 10px; }.table-name { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #607168; }.live-dot { width: 6px; height: 6px; border-radius: 50%; background: #b0b8b2; display: inline-block; }.live-dot.active { background: #3b9a70; box-shadow: 0 0 0 3px #3b9a7014; }.table-capacity { display: flex; gap: 7px; align-items: center; font-size: 12px; color: var(--muted); }.round-count { font-size: 12px; color: var(--muted); }.round-count b { color: var(--ink); font-size: 15px; margin: 0 3px; }
.poker-scene { height: 495px; position: relative; margin-top: 4px; }.table-rim { position: absolute; inset: 53px 22px; background: #253b31; border-radius: 48%; padding: 13px; box-shadow: 0 17px 20px -14px #1d362d40, inset 0 2px 1px #ffffff26, 0 0 0 1px #1d3026; }.felt { height: 100%; position: relative; border-radius: inherit; background-color: #194f40; background-image: url('../assets/felt.svg'); box-shadow: inset 0 3px 12px #0c2e2b66; overflow: hidden; }.felt-outline { position: absolute; inset: 18px; border-radius: inherit; border: 1px solid #a8bda83d; }.table-center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #fff; }.felt-wordmark { display: flex; gap: 6px; align-items: center; font-size: 10px; color: #c2d2b580; font-weight: 600; margin-bottom: 18px; }.idle-cards { display: flex; gap: 5px; padding: 2px 0 7px; }.idle-cards>*:first-child { transform: rotate(-13deg) translateY(4px); }.idle-cards>*:last-child { transform: rotate(9deg); }.table-center h2 { font-weight: 500; font-size: 20px; margin: 16px 0 8px; }.felt-subtitle { font-size: 8px; color: #c8d7c280; }.community-cards { display: flex; gap: 7px; margin: 16px 0 15px; }.pot-label { color: #aec9b9; font-size: 10px; margin-bottom: 4px; }.pot-amount { font-family: var(--numbers); font-size: 29px; font-weight: 500; display: flex; align-items: center; gap: 9px; line-height: 1; }.chip-mini { width: 17px; height: 17px; border: 3px dashed #b4cba6; outline: 1px solid #b4cba6; border-radius: 50%; }.street-label { font-size: 11px; color: #d8e5d4; }.street-label>span { color: #b8cebb; }
.player-seat { position: absolute; left: var(--seat-x); top: var(--seat-y); transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; width: 112px; z-index: 2; }.avatar { width: 47px; height: 47px; border: 3px solid var(--page); border-radius: 50%; display: grid; place-items: center; font-size: 19px; font-weight: 550; position: relative; box-shadow: 0 2px 6px #152b1810; }.avatar-0 { background: #dce8dd; color: #37614a; }.avatar-1 { background: #eedfe1; color: #9c5e68; }.avatar-2 { background: #dce5ee; color: #5b7897; }.avatar-3 { background: #f0e8cc; color: #9e884d; }.seat-empty .avatar { background: #eff1ee; border: 1px dashed #cbd1cb; color: #b1b9b1; }.seat-details { margin-top: 4px; background: var(--page); padding: 2px 7px; text-align: center; border-radius: 4px; max-width: 132px; }.seat-name { font-size: 12px; font-weight: 550; display: block; overflow-wrap: anywhere; max-width: 117px; }.seat-chips { font-size: 11px; color: var(--muted); display: block; margin-top: 3px; font-family: var(--numbers); }.you-label { font-size: 9px; color: #658b70; margin-left: 4px; }.seat-empty .seat-name { color: #8e978f; font-weight: 400; }.seat-empty .seat-chips { color: #b0b6b0; }.seat-active .avatar { outline: 2px solid #549a70; box-shadow: 0 0 0 6px #549a701a; }.seat-active .seat-chips { color: var(--green); }.seat-folded { opacity: .52; }.online-dot { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; background: #b7bdb7; border: 2px solid var(--page); border-radius: 50%; }.online-dot.online { background: #63a679; }.dealer-badge { position: absolute; top: 4px; right: 12px; z-index: 3; background: #fafafa; border: 1px solid #cccfc8; color: #59625b; height: 20px; width: 20px; font-size: 10px; border-radius: 50%; display: grid; place-items: center; box-shadow: 0 2px 3px #0001; }.seat-action { margin-top: 3px; font-size: 10px; padding: 3px 7px; background: #e3ebe2; border-radius: 3px; color: #4b6a53; }.seat-cards { position: absolute; top: -43px; display: flex; gap: 3px; }.table-bottom { display: flex; align-items: center; justify-content: space-between; color: #7e8b81; padding: 3px 10px 19px; font-size: 11px; }.table-bottom>div { display: flex; align-items: center; gap: 9px; }.chip-stack { width: 18px; height: 19px; position: relative; display: inline-block; }.chip-stack i { position: absolute; width: 17px; height: 8px; background: #e3e8df; border: 1px solid #a6b49e; border-radius: 50%; left: 0; bottom: 1px; }.chip-stack i:nth-child(2) { bottom: 5px; }.chip-stack i:nth-child(3) { bottom: 9px; }
.table-note { padding: 21px 10px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 8px; font-size: 11px; color: #8b958e; }.note-right { margin-left: auto; font-size: 8px; }
.control-panel { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 25px; margin-top: 0; box-shadow: 0 5px 12px #233d2910; }.section-eyebrow { font-size: 9px; font-weight: 600; color: #8d9b90; }.panel-heading h2 { font-size: 20px; font-weight: 600; margin: 7px 0 24px; }.segmented { display: flex; height: 39px; padding: 3px; background: #f1f3f0; border-radius: 5px; margin-bottom: 24px; }.segmented button { flex: 1; font-size: 12px; color: #859087; border: 0; background: transparent; border-radius: 3px; }.segmented button.selected { background: white; color: var(--green); box-shadow: 0 1px 4px #00000010; font-weight: 550; }.field-label { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 500; margin: 19px 0 9px; }.field-label>span { color: #99a298; font-size: 10px; font-weight: 400; }.field-row { display: flex; justify-content: space-between; align-items: baseline; }.field-hint { font-size: 10px; color: #98a198; }.stepper { height: 43px; display: flex; border: 1px solid var(--line); border-radius: 4px; align-items: center; justify-content: space-between; }.stepper button { display: grid; place-items: center; height: 100%; width: 42px; background: none; border: 0; color: #738578; }.stepper output { font-family: var(--numbers); font-size: 17px; }.stepper output span { font-size: 11px; margin-left: 4px; color: var(--muted); }.input-with-icon { position: relative; }.input-with-icon svg { position: absolute; top: 13px; left: 12px; color: #8e9a8d; }.input-with-icon input { padding-left: 37px; font-family: var(--numbers); }.preset-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 7px; }.preset-row button { border: 1px solid #e8ece5; color: #8a9589; background: #fafbf9; border-radius: 3px; padding: 6px 2px; font-size: 10px; }.preset-row button.chosen { color: #477650; background: #eff5eb; border-color: #c8d7be; }.two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.two-fields input { font-family: var(--numbers); }.settings-summary { display: flex; justify-content: space-between; margin: 16px 0 22px; font-size: 10px; color: #939d92; }.settings-summary b { color: #6f7e6a; font-weight: 500; margin-left: 4px; }.start-button svg:last-child { margin-left: auto; }.start-button { justify-content: start; }.panel-footnote { border-top: 1px solid #eff1ec; padding-top: 17px; margin-top: 22px; text-align: center; color: #9aa294; font-size: 10px; }.panel-footnote .tiny-dot { margin-right: 4px; }.resume-button { margin-top: 15px; padding: 0; display: flex; justify-content: center; align-items: center; gap: 6px; background: none; border: 0; color: #5a7b5b; font-size: 11px; width: 100%; }.code-input { font-family: var(--numbers); text-transform: uppercase; }.information { display: flex; align-items: center; gap: 10px; border: 1px solid #d3e0d0; background: #eef4eb; padding: 12px 15px; margin-bottom: 20px; font-size: 12px; color: #597153; line-height: 1.8; border-radius: 5px; }.information>svg { flex-shrink: 0; }.information button { margin-left: auto; flex-shrink: 0; }.alert { margin-bottom: 18px; background: #f6f0dd; border: 1px solid #e4d7aa; padding: 10px 14px; font-size: 12px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }.alert.error { background: #fcf0ee; border-color: #efd6d0; color: #ab5651; }
.count-badge { font-size: 11px; font-weight: 400; color: #8e9c8e; float: right; margin-top: 6px; }.invite-code { padding: 14px 12px; background: #f4f6f2; display: flex; align-items: center; margin-bottom: 10px; border-radius: 4px; gap: 10px; }.invite-code>span { font-size: 10px; color: var(--muted); }.invite-code>b { font-family: var(--numbers); font-size: 21px; font-weight: 500; }.invite-code>button { margin-left: auto; }.guest-list { margin: 18px 0; }.guest-row { display: flex; align-items: center; gap: 10px; min-height: 57px; border-bottom: 1px solid #f0f2ed; }.list-avatar { width: 31px; height: 31px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; font-size: 12px; }.guest-name { font-size: 12px; flex: 1; overflow-wrap: anywhere; min-width: 0; }.guest-name>small { color: #8a9889; font-size: 10px; }.guest-name>span { display: block; color: #98a293; font-size: 10px; margin-top: 4px; }.crown { color: #ad9857; }.vacant { color: #acb3a7; font-size: 11px; }.vacant .list-avatar { border: 1px dashed #dce2d5; }.guest-row>button { width: 28px; height: 28px; }.lobby-settings { border-top: 1px solid var(--line); padding: 16px 0 23px; display: flex; gap: 20px; }.lobby-settings>span { font-size: 10px; color: var(--muted); flex: 1; }.lobby-settings b { display: block; font-size: 15px; color: var(--ink); margin-top: 7px; font-weight: 500; }.waiting-host { display: flex; justify-content: center; align-items: center; gap: 9px; padding: 16px 0 4px; font-size: 12px; color: #74886b; }.hand-bar { border-top: 1px solid var(--line); padding: 22px 12px; display: flex; align-items: center; justify-content: space-between; gap: 15px; }.own-hand { display: flex; align-items: center; gap: 17px; }.own-cards { display: flex; gap: 5px; }.own-hand h3 { font-size: 16px; font-weight: 550; margin: 6px 0 12px; }.hand-toggle { display: flex; align-items: center; gap: 5px; font-size: 11px; }.hand-status { font-size: 11px; color: var(--muted); text-align: right; }.hand-status>b { display: block; font-size: 23px; color: var(--ink); font-family: var(--numbers); font-weight: 500; margin-top: 12px; }.hand-status small { font-size: 10px; color: var(--muted); font-family: var(--font); font-weight: 400; }.your-turn { color: var(--green); }.results-band { border-top: 1px solid var(--line); padding: 23px 12px; display: flex; gap: 18px; align-items: center; color: #9e8849; }.results-band h3 { font-size: 17px; margin: 7px 0 6px; color: var(--ink); font-weight: 550; }.results-band p { font-size: 11px; margin: 5px 0; color: var(--muted); }.results-band p b { color: #64875d; margin-left: 8px; font-weight: 500; }.action-context { border: 1px solid #e7ece2; border-radius: 5px; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: #f8faf5; }.action-context>span { font-size: 10px; color: #8c9b84; }.action-context>b { font-size: 16px; font-weight: 500; }.action-context strong { color: #617b56; font-family: var(--numbers); font-size: 13px; margin-left: 5px; }.call-summary { display: flex; justify-content: space-between; align-items: center; margin: 25px 0 14px; font-size: 12px; color: var(--muted); }.call-summary>b { font-family: var(--numbers); font-size: 21px; color: var(--ink); font-weight: 500; }.action-buttons { display: grid; grid-template-columns: .8fr 1.2fr; gap: 8px; }.fold-button { background: #faf4f2; color: #a76f62; border: 1px solid #ecdcd5; }.raise-control { margin-top: 24px; border-top: 1px solid var(--line); padding-top: 1px; }.raise-control input[type=range] { padding: 0; border: 0; height: 22px; margin: 13px 0 0; accent-color: var(--green); box-shadow: none; }.range-labels { display: flex; justify-content: space-between; color: #9aa58f; font-size: 10px; font-family: var(--numbers); }.bet-presets { display: flex; gap: 7px; margin: 16px 0; }.bet-presets button { flex: 1; background: #f6f8f2; border: 1px solid #e7ecdd; border-radius: 3px; padding: 7px 2px; font-size: 11px; color: #7c8e70; }.game-details { border-top: 1px solid var(--line); margin-top: 25px; padding-top: 18px; display: flex; flex-direction: column; gap: 13px; }.game-details>span { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); }.game-details b { font-family: var(--numbers); font-size: 13px; font-weight: 500; color: var(--ink); }.waiting-state { display: flex; align-items: center; flex-direction: column; padding: 38px 0 20px; gap: 12px; }.waiting-spade { color: #b9c9b4; margin-bottom: 8px; }.waiting-state>b { font-size: 14px; font-weight: 500; }.waiting-state>span:last-child { font-size: 11px; color: var(--muted); }.ranking { margin-bottom: 24px; }.ranking-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; column-gap: 9px; align-items: center; padding: 16px 0; border-bottom: 1px solid #edf0e8; font-size: 12px; }.ranking-row>span:nth-child(2) { overflow-wrap: anywhere; }.rank-number { color: #a1ac96; font-family: var(--numbers); }.rank-number.first { color: #ae9854; }.ranking-row b { font-family: var(--numbers); font-size: 17px; font-weight: 500; }.ranking-row>small { grid-column: 3; text-align: right; margin-top: 5px; font-size: 10px; }.ranking-row span small { font-size: 10px; color: var(--muted); }.green { color: #64865c; }.loss { color: #b8786b; }.finish-note { font-size: 10px; color: #739469; margin-bottom: 20px; display: flex; align-items: center; gap: 7px; }.ended-icon { text-align: center; padding: 28px 0; color: #96ae8d; }.centered { text-align: center; font-size: 12px; margin: 0 0 30px; }.footer { margin-top: 34px; border-top: 1px solid var(--line); padding: 22px 0; display: flex; justify-content: space-between; font-size: 10px; color: #939d90; }.footer-separator { margin: 0 9px; color: #b8c0b1; }.footer>span:last-child { display: flex; align-items: center; gap: 8px; }
@media (min-width: 1400px) { .poker-scene { height: 545px; }.table-rim { inset: 55px 27px; } }
@media (max-width: 1050px) { .workspace { grid-template-columns: minmax(0, 1fr) 295px; gap: 18px; }.control-panel { padding: 21px; }.poker-scene { height: 470px; }.table-rim { inset: 58px 12px; padding: 10px; }.community-cards { gap: 4px; }.community-cards :deep(.playing-card) { width: 49px; height: 72px; }.community-cards :deep(.corner) { font-size: 16px; }.community-cards :deep(.center-suit) { font-size: 25px; }.player-seat { width: 95px; }.avatar { width: 42px; height: 42px; }.seat-details { padding: 2px 5px; }.header-center { display: none; } }
@media (max-width: 800px) { main { padding: 26px 20px 0; }.topbar { height: 72px; padding: 0 20px; }.workspace { grid-template-columns: minmax(0, 1fr); gap: 20px; }.control-panel { padding: 24px; }.page-heading { margin-bottom: 20px; }h1 { font-size: 25px; }.poker-scene { height: 440px; max-width: 650px; margin-inline: auto; }.table-rim { inset: 47px 26px; }.player-seat { width: 110px; }.community-cards :deep(.playing-card) { width: 58px; height: 82px; }.control-panel form { display: grid; grid-template-columns: 1fr; }.table-note { padding-bottom: 3px; }.table-bottom { padding-bottom: 18px; }.footer { margin-top: 25px; }.hand-bar { padding-bottom: 5px; }.header-actions { gap: 8px; }.connection-label { font-size: 11px; }.page-heading .room-code-label { display: none; }.page-heading .room-header-actions .icon-button:first-of-type { display: none; } }
@media (max-width: 480px) { main { padding: 23px 14px 0; }.topbar { padding: 0 17px; height: 68px; }.brand-mark { width: 34px; height: 38px; }.brand-name { font-size: 20px; }.brand-name>span { font-size: 8px; margin-top: 6px; }.header-actions { gap: 5px; }.connection-label { font-size: 10px; gap: 4px; }.heading-tag { font-size: 8px; padding: 7px; gap: 4px; }.heading-tag svg { width: 11px; }h1 { font-size: 23px; }.eyebrow { font-size: 8px; }.page-heading { gap: 7px; }.poker-scene { height: 405px; }.table-rim { inset: 49px 8px; border-radius: 44%; padding: 9px; }.felt-outline { inset: 12px; }.player-seat { width: 84px; }.avatar { width: 39px; height: 39px; font-size: 15px; }.seat-details { max-width: 92px; padding: 2px 5px; }.seat-name { font-size: 10px; max-width: 78px; }.seat-chips { font-size: 10px; margin-top: 2px; }.dealer-badge { width: 17px; height: 17px; right: 7px; top: 0; font-size: 9px; }.seat-action { font-size: 9px; padding: 2px 4px; }.seat-cards { top: -40px; }.seat-cards :deep(.small) { width: 29px; height: 40px; }.felt-wordmark { font-size: 8px; margin-bottom: 14px; }.table-center h2 { font-size: 18px; margin-top: 17px; }.felt-subtitle { font-size: 6px; }.idle-cards { gap: 3px; }.community-cards { gap: 4px; margin: 13px 0 12px; }.community-cards :deep(.playing-card) { width: 43px; height: 62px; }.community-cards :deep(.corner) { font-size: 14px; left: 4px; top: 4px; }.community-cards :deep(.corner span) { font-size: 10px; }.community-cards :deep(.bottom) { top: auto; left: auto; bottom: 4px; right: 4px; }.community-cards :deep(.center-suit) { font-size: 21px; }.pot-label { font-size: 9px; }.pot-amount { font-size: 25px; }.street-label { font-size: 9px; }.table-bottom { padding-inline: 4px; font-size: 10px; }.table-toolbar { padding: 0 5px; }.note-right { display: none; }.table-note { font-size: 10px; padding-inline: 4px; padding-top: 15px; }.control-panel { padding: 23px; }.panel-heading h2 { font-size: 20px; }.footer { font-size: 9px; padding: 19px 2px; }.hand-bar { padding: 18px 3px 0; }.own-hand { gap: 11px; }.own-hand h3 { font-size: 14px; }.hand-status { font-size: 10px; }.hand-status>b { font-size: 21px; }.results-band { padding: 20px 3px 0; }.results-band h3 { font-size: 15px; }.table-area.is-playing .poker-scene { margin-top: 26px; } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
</style>

<style scoped>
.player-seat { left: clamp(44px, var(--seat-x), calc(100% - 44px)); }
.seat-upper .seat-cards { top: 100%; margin-top: 4px; }
.ranking-hand { grid-column: 2 / 4; display: flex; gap: 4px; margin-top: 8px; }
@media (max-width: 800px) { .no-room .control-panel { order: -1; }.no-room .table-area { margin-top: 10px; }.page-heading .room-header-actions .icon-button.leave-button { display: inline-grid; } }
@media (max-width: 480px) { .seat-cards { display: none; }.community-cards :deep(.playing-card) { width: min(39px, calc((100vw - 178px) / 5)); } }
</style>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { ArrowRight, ArrowUpRight, Bot, Check, Copy, Crown, Layers3, Link, LoaderCircle, Minus, Plus, RotateCcw, ShieldCheck, Spade, Users, X } from 'lucide-vue-next'
import AppHeader from '../components/AppHeader.vue'
import PlayingCard from '../components/PlayingCard.vue'
import { useRoomStore } from '../stores/room'

const ConfirmDialog = defineAsyncComponent(() => import('../components/ConfirmDialog.vue'))
const room = useRoomStore()
const mode = ref<'solo' | 'host' | 'join'>(new URLSearchParams(location.search).has('room') ? 'join' : 'solo')
const name = ref('')
const code = ref(new URLSearchParams(location.search).get('room') ?? '')
const count = ref(4)
const chips = ref(1000)
const rounds = ref(10)
const blind = ref(10)
const formError = ref('')
const copied = ref(false)
const confirmLeave = ref(false)
const isSolo = computed(() => mode.value === 'solo')
const fmt = (value: number) => value.toLocaleString('en-US')
async function submit() {
  formError.value = ''
  if (!isSolo.value && !name.value.trim()) { formError.value = '先给自己取个昵称'; return }
  const settings = { chips: chips.value, rounds: rounds.value, smallBlind: blind.value }
  if (isSolo.value) room.solo(name.value, settings, count.value)
  else if (mode.value === 'host') await room.host(name.value, settings, count.value)
  else await room.join(name.value, code.value)
}
async function copy(invite: boolean) {
  if (!room.view) return
  const url = new URL(location.href)
  url.search = ''
  url.searchParams.set('room', room.view.code)
  url.hash = '/'
  try {
    await navigator.clipboard.writeText(invite ? url.toString() : room.view.code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2200)
  } catch { room.error = `复制失败，请手动复制房间码：${room.view.code}` }
}
function leave() { confirmLeave.value = false; room.leave() }
</script>

<template>
  <div class="lobby-page">
    <AppHeader />
    <main class="lobby-main">
      <div class="lobby-title"><span class="eyebrow">THE NIGHT STARTS HERE</span><h1>同桌，开一局。</h1><div class="title-rule"><Spade :size="15" fill="currentColor" /><span>TEXAS HOLD'EM</span><i></i></div></div>
      <section class="preparation">
        <div class="setup-intro" aria-hidden="true"><div class="card-composition"><PlayingCard card="As" /><PlayingCard card="Ah" /><div class="poker-chip chip-green">T</div><div class="poker-chip chip-red">T</div></div><div class="intro-caption"><span>GOOD CARDS.</span><span>BETTER COMPANY.</span></div><div class="intro-bottom"><span>01 / TAKE YOUR SEAT</span><Spade :size="16" /></div></div>
        <div class="setup-content">
          <div v-if="room.error || formError" class="alert error" role="alert"><span>{{ room.error || formError }}</span><button class="icon-button" title="关闭错误提示" @click="room.error = ''; formError = ''"><X :size="16" /></button></div>
          <div v-if="room.notice && !room.view?.ended" class="alert" role="status"><span>{{ room.notice }}</span><button v-if="!room.connected && room.saved" class="text-button" :disabled="room.busy" @click="room.resume()">重新连接</button></div>

          <template v-if="!room.view">
            <div class="setup-heading"><div><span class="eyebrow">TAKE A SEAT</span><h2>今晚的牌局</h2></div><span class="step-indicator">01 <span>/ 02</span></span></div>
            <div class="mode-selector" aria-label="对局模式"><button :class="{ selected: mode === 'solo' }" :aria-pressed="isSolo" :disabled="room.busy" @click="mode = 'solo'"><Bot :size="17" />单机模式</button><button :class="{ selected: mode === 'host' }" :aria-pressed="mode === 'host'" :disabled="room.busy" @click="mode = 'host'"><Plus :size="17" />创建房间</button><button :class="{ selected: mode === 'join' }" :aria-pressed="mode === 'join'" :disabled="room.busy" @click="mode = 'join'"><Users :size="17" />加入房间</button></div>
            <form @submit.prevent="submit">
              <label class="field-label" for="nickname">你的昵称</label><input id="nickname" v-model="name" autocomplete="nickname" maxlength="12" :placeholder="isSolo ? '玩家' : '怎么称呼你？'" :required="!isSolo" :disabled="room.busy" />
              <template v-if="mode === 'join'"><label class="field-label" for="room-code">房间码</label><input id="room-code" v-model="code" class="code-input" maxlength="6" placeholder="6 位房间码" required :disabled="room.busy" autocapitalize="characters" autocomplete="off" /></template>
              <template v-else>
                <div class="field-row"><label class="field-label" for="player-count">{{ isSolo ? '对局人数' : '座位人数' }}</label><span>{{ isSolo ? `你 + ${count - 1} 个机器人` : '2–8 人' }}</span></div><div class="stepper"><button type="button" title="减少人数" :disabled="count <= 2 || room.busy" @click="count--"><Minus :size="17" /></button><output id="player-count">{{ count }} <span>人</span></output><button type="button" title="增加人数" :disabled="count >= 8 || room.busy" @click="count++"><Plus :size="17" /></button></div>
                <label class="field-label" for="initial-chips">初始筹码 <span>每人</span></label><div class="input-with-icon"><Layers3 :size="17" /><input id="initial-chips" v-model.number="chips" type="number" min="100" max="1000000" step="1" required :disabled="room.busy" /></div><div class="presets"><button v-for="n in [500, 1000, 2000, 5000]" :key="n" type="button" :class="{ chosen: chips === n }" :disabled="room.busy" @click="chips = n">{{ fmt(n) }}</button></div>
                <div class="two-fields"><div><label class="field-label" for="rounds">对局轮数</label><input id="rounds" v-model.number="rounds" type="number" min="1" max="100" step="1" required :disabled="room.busy" /></div><div><label class="field-label" for="blind">小盲注</label><input id="blind" v-model.number="blind" type="number" min="1" :max="Math.floor(chips / 2)" step="1" required :disabled="room.busy" /></div></div><div class="settings-summary"><span>大盲注 <b>{{ fmt(blind * 2) }}</b></span><span>总筹码 <b>{{ fmt(chips * count) }}</b></span></div>
              </template>
              <button type="submit" class="button primary full-width start-button" :disabled="room.busy"><LoaderCircle v-if="room.busy" :size="18" class="spin" /><Bot v-else-if="isSolo" :size="18" /><Spade v-else :size="17" fill="currentColor" />{{ room.busy ? '正在连接…' : isSolo ? '开始单机对局' : mode === 'host' ? '创建牌局' : '加入牌局' }}<ArrowRight v-if="!room.busy" :size="19" /></button>
            </form>
            <button v-if="room.saved" class="resume-button" :disabled="room.busy" @click="room.resume()"><RotateCcw :size="15" />恢复上次对局<ArrowUpRight :size="15" /></button>
            <p class="setup-note"><ShieldCheck :size="14" />{{ isSolo ? '本机对局 · 无需连接房间' : '筹码仅用于朋友间的娱乐计分' }}</p>
          </template>

          <template v-else-if="room.view.ended">
            <div class="setup-heading"><div><span class="eyebrow">UNTIL NEXT TIME</span><h2>这桌已散场</h2></div><Spade :size="27" /></div><p class="ended-text">房间已关闭，本局数据已清除。</p><button class="button primary full-width" @click="leave">再开一桌<ArrowRight :size="18" /></button>
          </template>

          <template v-else>
            <div class="setup-heading"><div><span class="eyebrow">THE GUEST LIST</span><h2>等朋友入座</h2></div><span class="step-indicator">{{ room.view.seats.length }}<span>/ {{ room.view.capacity }}</span></span></div>
            <div class="invite-code"><span>房间码</span><b>{{ room.view.code }}</b><button class="icon-button" title="复制房间码" @click="copy(false)"><component :is="copied ? Check : Copy" :size="18" /></button></div><button class="button secondary full-width" @click="copy(true)"><Link :size="16" />{{ copied ? '已复制' : '复制邀请链接' }}</button>
            <div class="guest-list"><div v-for="(seat, i) in room.view.seats" :key="i" class="guest-row"><span class="guest-avatar">{{ seat.name.slice(0, 1) }}</span><span class="guest-name">{{ seat.name }}<small v-if="i === room.view.me"> (你)</small><span>{{ i === 0 ? '房主' : seat.online ? '准备就绪' : '已断开连接' }}</span></span><Crown v-if="i === 0" :size="16" class="crown" /><button v-else-if="room.view.host" class="icon-button" :title="`移除 ${seat.name}`" @click="room.removeSeat(i)"><X :size="15" /></button><Check v-else-if="seat.online" :size="17" /></div><div v-for="i in Math.max(0, room.view.capacity - room.view.seats.length)" :key="`empty-${i}`" class="guest-row vacant"><span class="guest-avatar"><Plus :size="16" /></span><span>等待朋友加入</span></div></div>
            <div class="lobby-settings"><span>初始筹码<b>{{ fmt(room.view.settings.chips) }}</b></span><span>对局轮数<b>{{ room.view.settings.rounds }} 轮</b></span><span>盲注<b>{{ room.view.settings.smallBlind }} / {{ room.view.settings.smallBlind * 2 }}</b></span></div>
            <button v-if="room.view.host" class="button primary full-width" :disabled="room.view.seats.length < 2 || room.view.seats.some(s => !s.online) || !room.connected" @click="room.start()"><Spade :size="17" fill="currentColor" />洗牌，进入牌桌<ArrowRight :size="18" /></button><div v-else class="waiting-host"><LoaderCircle :size="17" class="spin" />等待房主开始牌局</div>
            <button class="resume-button" @click="confirmLeave = true">{{ room.view.host ? '关闭房间' : '离开房间' }}</button>
          </template>
        </div>
      </section>
      <footer class="lobby-footer"><span>只留此刻，不留战绩。</span><span>快乐比输赢重要 <Spade :size="11" fill="currentColor" /></span></footer>
    </main>
    <ConfirmDialog v-if="confirmLeave && room.view" :host="room.view.host" @close="confirmLeave = false" @confirm="leave" />
  </div>
</template>

<style scoped>
.lobby-main { max-width: 1080px; margin: auto; padding: 36px 40px 0; }.lobby-title { margin-bottom: 28px; }.eyebrow { font-size: 9px; font-weight: 600; color: #8a9885; }h1 { font-size: 32px; font-weight: 650; margin: 9px 0 14px; }.title-rule { display: flex; align-items: center; gap: 9px; color: #7f9277; font-size: 9px; }.title-rule i { flex: 1; height: 1px; background: #dfe6d8; margin-left: 9px; }
.preparation { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #dce4d6; border-bottom: 1px solid #dce4d6; }.setup-intro { background: #e9eee3; padding: 35px; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; }.card-composition { position: relative; height: 230px; width: 230px; align-self: center; margin-top: 20px; }.card-composition :deep(.playing-card) { position: absolute; width: 108px; height: 152px; left: 15px; top: 20px; transform: rotate(-17deg); box-shadow: 0 12px 15px #23372715; }.card-composition :deep(.playing-card:nth-child(2)) { left: 106px; top: 49px; transform: rotate(13deg); }.card-composition :deep(.corner) { font-size: 30px; }.card-composition :deep(.corner span) { font-size: 22px; }.card-composition :deep(.center-suit) { font-size: 50px; }.poker-chip { position: absolute; display: grid; place-items: center; width: 60px; height: 60px; border-radius: 50%; border: 6px dashed #eff3e5; outline: 3px solid currentColor; font-size: 18px; font-weight: 600; box-shadow: 0 8px 10px #263a2c20; }.chip-green { background: #365c49; color: #365c49; left: 12px; top: 164px; }.chip-red { background: #b66d65; color: #b66d65; left: 57px; top: 180px; }.poker-chip::after { content: 'T'; position: absolute; color: #fff; }.intro-caption { margin: 50px 0 80px; display: flex; flex-direction: column; color: #466345; font-size: 25px; line-height: 1.6; font-weight: 500; }.intro-bottom { position: absolute; left: 35px; right: 35px; bottom: 28px; display: flex; align-items: center; justify-content: space-between; color: #95a38b; font-size: 9px; }
.setup-content { padding: 32px 38px 25px; background: #fff; min-width: 0; }.setup-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 23px; }h2 { font-size: 22px; font-weight: 600; margin: 7px 0 0; }.step-indicator { font-family: var(--numbers); font-size: 20px; color: #3d6548; }.step-indicator span { font-size: 12px; color: #a1ac98; margin-left: 5px; }.mode-selector { display: flex; border-bottom: 1px solid #e5eadd; margin-bottom: 21px; gap: 5px; }.mode-selector button { display: flex; justify-content: center; align-items: center; gap: 5px; flex: 1; border: 0; border-bottom: 2px solid transparent; background: none; padding: 12px 2px; color: #98a18f; font-size: 11px; white-space: nowrap; }.mode-selector button.selected { border-bottom-color: #3b6f4d; color: #315e3e; font-weight: 600; }.field-label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin: 17px 0 8px; }.field-label span,.field-row>span { font-size: 10px; color: #98a18e; }.field-row { display: flex; align-items: baseline; justify-content: space-between; }.stepper { height: 42px; border: 1px solid #dfe5da; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }.stepper button { display: grid; place-items: center; width: 42px; height: 100%; border: 0; background: none; color: #7d8f73; }.stepper output { font-size: 17px; font-family: var(--numbers); }.stepper output span { font-size: 11px; color: #8b9882; }.input-with-icon { position: relative; }.input-with-icon svg { position: absolute; left: 12px; top: 13px; color: #8d9d80; }.input-with-icon input { padding-left: 37px; font-family: var(--numbers); }.presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 7px; }.presets button { font-size: 10px; color: #8d9c7c; border: 1px solid #e3e9db; background: #fafbf8; border-radius: 3px; padding: 6px 0; }.presets .chosen { background: #edf3e7; color: #4f7444; border-color: #c9d9bd; }.two-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }.settings-summary { display: flex; justify-content: space-between; color: #96a08c; font-size: 10px; margin: 16px 0 22px; }.settings-summary b { color: #728263; font-weight: 500; margin-left: 6px; }.start-button { justify-content: start; height: 48px; margin-top: 21px; }.start-button svg:last-child { margin-left: auto; }.settings-summary+.start-button { margin-top: 0; }.resume-button { border: 0; background: none; color: #708d60; display: flex; align-items: center; gap: 6px; justify-content: center; width: 100%; font-size: 11px; margin-top: 17px; padding: 4px; }.setup-note { font-size: 10px; color: #9da88e; border-top: 1px solid #edf0e7; padding-top: 18px; margin: 22px 0 0; display: flex; align-items: center; justify-content: center; gap: 7px; }.code-input { text-transform: uppercase; font-family: var(--numbers); }.alert { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; line-height: 1.7; background: #f5f0dc; padding: 10px 12px; border-radius: 4px; margin-bottom: 16px; }.alert.error { background: #fcf0ec; color: #af675b; }.invite-code { display: flex; align-items: center; padding: 15px; gap: 14px; background: #f0f5eb; border-radius: 4px; margin-bottom: 10px; }.invite-code span { font-size: 11px; color: #8d9f7c; }.invite-code b { font-size: 25px; font-family: var(--numbers); font-weight: 500; }.invite-code button { margin-left: auto; }.guest-list { margin: 16px 0; }.guest-row { display: flex; align-items: center; gap: 11px; min-height: 56px; border-bottom: 1px solid #eef2e6; font-size: 12px; }.guest-avatar { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: #e7eedf; color: #72935b; flex-shrink: 0; }.guest-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }.guest-name small { color: #a4ae97; font-size: 10px; }.guest-name>span { display: block; font-size: 10px; color: #a3ad95; margin-top: 4px; }.crown { color: #ad9652; }.vacant { color: #abb59e; }.vacant .guest-avatar { background: none; border: 1px dashed #dce6cf; }.lobby-settings { display: flex; gap: 15px; margin: 20px 0; }.lobby-settings>span { flex: 1; font-size: 10px; color: #a0ac92; }.lobby-settings b { display: block; font-size: 14px; color: #647e50; font-weight: 500; margin-top: 6px; }.waiting-host { display: flex; align-items: center; justify-content: center; gap: 8px; color: #7b965f; font-size: 12px; padding: 18px 0; }.ended-text { font-size: 13px; line-height: 1.8; color: #8b9a7e; margin: 35px 0; }.lobby-footer { display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #9daa8c; padding: 24px 0; }.lobby-footer>span:last-child { display: flex; align-items: center; gap: 8px; }
@media(max-width:800px) { .lobby-main { padding: 28px 24px 0; }.preparation { grid-template-columns: 0.7fr 1fr; }.setup-intro { padding: 24px; }.setup-content { padding: 28px 26px 23px; }.card-composition { transform: scale(.8); }.intro-caption { font-size: 18px; }.intro-bottom { left: 24px; right: 24px; }.mode-selector button { font-size: 10px; } }
@media(max-width:600px) { .lobby-main { padding: 26px 20px 0; }.lobby-title { margin-bottom: 22px; }h1 { font-size: 28px; }.preparation { grid-template-columns: 1fr; }.setup-intro { display: none; }.setup-content { padding: 25px 20px 22px; }.mode-selector { gap: 0; }.mode-selector button { font-size: 11px; padding: 13px 0; }.mode-selector svg { width: 15px; }.lobby-footer { font-size: 9px; }.setup-heading { margin-bottom: 16px; } }
</style>

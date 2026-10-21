import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import Peer, { type DataConnection } from 'peerjs'
import { act, createGame, startRound, type Game, type Settings } from '../game/engine'
import { chooseBotAction } from '../game/bot'

interface Seat { token: string; name: string; online: boolean }
export interface RoomView {
  lastMove?: { playerId: number; label: string; amount: number; sequence: number } | null
  mode: 'solo' | 'online'
  code: string
  host: boolean
  me: number
  revision: number
  seats: { name: string; online: boolean; bot?: boolean }[]
  capacity: number
  settings: Omit<Settings, 'names'>
  game: Omit<Game, 'deck'> | null
  ended: boolean
}
interface SavedRoom {
  role: 'host' | 'guest' | 'solo'; code: string; token: string; name: string
  seats?: Seat[]; settings?: Omit<Settings, 'names'>; capacity?: number; game?: Game | null
}
const storageKey = 'tablemates.active.v1'
const prefix = 'tablemates-v1-'
function readSaved(): SavedRoom | null {
  try { return JSON.parse(localStorage.getItem(storageKey) || 'null') as SavedRoom | null } catch { return null }
}
export const useRoomStore = defineStore('room', () => {
  const view = ref<RoomView | null>(null)
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const connected = ref(false)
  const saved = ref(!!readSaved())
  let peer: Peer | null = null
  let hostConnection: DataConnection | null = null
  let connections = new Map<string, DataConnection>()
  let credentials: SavedRoom | null = null
  let seats: Seat[] = []
  let game: Game | null = null
  let settings: Omit<Settings, 'names'> = { chips: 1000, rounds: 10, smallBlind: 10 }
  let capacity = 6
  let revision = 0
  let lastMove: RoomView['lastMove'] = null
  let timeout: ReturnType<typeof setTimeout> | undefined
  let botTimeout: ReturnType<typeof setTimeout> | undefined
  const me = computed(() => view.value?.game?.players[view.value.me] ?? null)

  function persist() {
    if (!credentials) return
    try {
      if (game?.finished || view.value?.ended) {
        localStorage.removeItem(storageKey)
        saved.value = false
      } else {
        const payload = credentials.role !== 'guest' ? { ...credentials, seats, settings, capacity, game } : credentials
        localStorage.setItem(storageKey, JSON.stringify(payload))
        saved.value = true
      }
    } catch { notice.value = '浏览器无法保存本局，请保持页面开启' }
  }
  function snapshot(index: number): RoomView {
    const visibleGame = game ? JSON.parse(JSON.stringify(game)) as Game : null
    if (visibleGame) {
      visibleGame.deck = []
      visibleGame.players.forEach((p, i) => {
        if (i !== index && !(game!.street === 'showdown' && !p.folded && game!.players.filter(p => !p.folded && p.cards.length).length > 1)) p.cards = []
      })
    }
    return {
      lastMove,
      mode: credentials!.role === 'solo' ? 'solo' : 'online',
      code: credentials!.code, host: index === 0, me: index, revision,
      seats: seats.map((s, i) => ({ name: s.name, online: s.online, bot: credentials!.role === 'solo' && i > 0 })),
      capacity, settings: { ...settings }, game: visibleGame, ended: false,
    }
  }
  function broadcast() {
    revision++
    view.value = snapshot(0)
    connections.forEach((conn, token) => {
      const index = seats.findIndex(s => s.token === token)
      if (conn.open && index >= 0) conn.send({ type: 'state', view: snapshot(index) })
    })
    persist()
    scheduleBot()
  }
  function scheduleBot() {
    clearTimeout(botTimeout)
    if (credentials?.role !== 'solo' || !game || game.finished || game.street === 'showdown' || game.turn <= 0) return
    const expectedRevision = revision
    botTimeout = setTimeout(() => {
      if (credentials?.role !== 'solo' || !game || revision !== expectedRevision) return
      try {
        const decision = chooseBotAction(game)
        takeAction(decision.kind, decision.amount)
        broadcast()
      } catch (err) { fail(err instanceof Error ? err.message : '机器人行动失败') }
    }, 600 + Math.floor(Math.random() * 450))
  }
  function fail(message: string) {
    error.value = message
    busy.value = false
    clearTimeout(timeout)
  }
  function takeAction(kind: 'fold' | 'call' | 'raise', amount = 0) {
    if (!game) return
    const actor = game.players[game.turn]!
    const before = actor.chips
    const owed = Math.max(0, game.currentBet - actor.bet)
    const currentBet = game.currentBet
    const paid = kind === 'fold' ? 0 : Math.min(before, kind === 'raise' ? amount - actor.bet : owed)
    act(game, kind, amount)
    lastMove = {
      playerId: actor.id, sequence: revision + 1,
      label: kind === 'fold' ? '弃牌' : kind === 'call' && paid === 0 ? '过牌' : paid === before ? '全下' : kind === 'raise' ? currentBet === 0 ? '下注' : '加注' : '跟注',
      amount: paid,
    }
  }
  function dispose() {
    clearTimeout(timeout)
    clearTimeout(botTimeout)
    peer?.destroy()
    peer = null
    connections = new Map()
    hostConnection = null
    connected.value = false
  }
  function solo(name: string, options: Omit<Settings, 'names'>, count: number) {
    try {
      if (!Number.isInteger(count) || count < 2 || count > 8) throw new Error('人数需为 2 至 8 人')
      const humanName = name.trim() || '玩家'
      const names = [humanName, ...Array.from({ length: count - 1 }, (_, i) => humanName === `机器人 ${i + 1}` ? `AI ${i + 1}` : `机器人 ${i + 1}`)]
      const initialGame = createGame({ ...options, names })
      dispose()
      credentials = { role: 'solo', code: 'SOLO', token: crypto.randomUUID(), name: humanName }
      settings = { ...options }
      capacity = count
      seats = names.map(name => ({ token: crypto.randomUUID(), name, online: true }))
      game = initialGame
      lastMove = null
      busy.value = false
      error.value = ''
      notice.value = ''
      connected.value = true
      broadcast()
    } catch (err) { fail(err instanceof Error ? err.message : '无法开始单机对局') }
  }
  function initialize(id?: string): Promise<Peer> {
    dispose()
    busy.value = true
    error.value = ''
    return new Promise((resolve, reject) => {
      let iceServers: RTCIceServer[] | undefined
      try {
        if (import.meta.env.VITE_ICE_SERVERS) iceServers = JSON.parse(import.meta.env.VITE_ICE_SERVERS) as RTCIceServer[]
      } catch {
        fail('中继服务配置无效，请检查 VITE_ICE_SERVERS')
        reject(new Error('invalid ICE configuration'))
        return
      }
      const options = iceServers ? { config: { iceServers } } : {}
      const instance = id ? new Peer(id, options) : new Peer(options)
      peer = instance
      timeout = setTimeout(() => {
        fail('连接超时，请检查网络后重试')
        instance.destroy()
        reject(new Error('timeout'))
      }, 18000)
      instance.on('open', () => {
        clearTimeout(timeout)
        connected.value = true
        if (view.value) notice.value = ''
        resolve(instance)
      })
      instance.on('error', err => {
        const message = err.type === 'peer-unavailable' ? '没有找到房间，请检查房间码，确认房主在线' : err.type === 'unavailable-id' ? '房间仍在其他页面开启，请关闭原页面后重试' : '连接失败，请检查网络或更换网络重试'
        fail(message)
        reject(err)
      })
      instance.on('disconnected', () => { connected.value = false; notice.value = '连接服务已断开，正在重新连接'; if (!instance.destroyed) instance.reconnect() })
      instance.on('close', () => { connected.value = false })
    })
  }
  async function host(name: string, options: Omit<Settings, 'names'>, count: number) {
    try {
      // Validate all limits through the same engine used to start the game.
      createGame({ ...options, names: [name, '玩家'] })
      if (!Number.isInteger(count) || count < 2 || count > 8) throw new Error('人数需为 2 至 8 人')
      credentials = { role: 'host', code: Array.from(crypto.getRandomValues(new Uint8Array(6)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 31]).join(''), token: crypto.randomUUID(), name: name.trim() }
      settings = { ...options }
      capacity = count
      seats = [{ token: credentials.token, name: credentials.name, online: true }]
      game = null
      lastMove = null
      const instance = await initialize(prefix + credentials.code)
      acceptConnections(instance)
      busy.value = false
      notice.value = ''
      broadcast()
    } catch (err) { if (!error.value) fail(err instanceof Error ? err.message : '创建失败') }
  }
  function acceptConnections(instance: Peer) {
    instance.on('connection', conn => {
      let authenticatedToken = ''
      const handshakeTimeout = setTimeout(() => { if (!authenticatedToken) conn.close() }, 10000)
      conn.on('data', raw => {
        try {
          const data = raw as Record<string, unknown>
          if (!data || typeof data !== 'object') return
          if (data.type === 'join' && !authenticatedToken) {
            if (typeof data.token !== 'string' || data.token.length > 80 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 12) return
            let index = seats.findIndex(s => s.token === data.token)
            if (index === 0) { conn.send({ type: 'error', message: '房主身份无法作为玩家加入' }); return }
            if (index < 0) {
              if (game || seats.length >= capacity || view.value?.ended) { conn.send({ type: 'error', message: game ? '牌局已经开始，暂时无法加入' : '房间已满或已结束' }); return }
              if (seats.some(s => s.name === (data.name as string).trim())) { conn.send({ type: 'error', message: '昵称已被使用，请换一个昵称' }); return }
              seats.push({ token: data.token, name: data.name.trim(), online: true })
              index = seats.length - 1
            }
            authenticatedToken = data.token
            clearTimeout(handshakeTimeout)
            const old = connections.get(authenticatedToken)
            connections.set(authenticatedToken, conn)
            old?.close()
            seats[index]!.online = true
            broadcast()
          } else if (data.type === 'action' && authenticatedToken && game) {
            const index = seats.findIndex(s => s.token === authenticatedToken)
            if (index !== game.turn || data.revision !== revision || !['fold', 'call', 'raise'].includes(data.action as string)) return
            takeAction(data.action as 'fold' | 'call' | 'raise', Number(data.amount))
            broadcast()
          }
        } catch (err) { conn.send({ type: 'error', message: err instanceof Error ? err.message : '操作失败' }) }
      })
      const disconnected = () => {
        clearTimeout(handshakeTimeout)
        if (authenticatedToken && connections.get(authenticatedToken) === conn) {
          connections.delete(authenticatedToken)
          const seat = seats.find(s => s.token === authenticatedToken)
          if (seat) seat.online = false
          if (credentials?.role === 'host' && !view.value?.ended) broadcast()
        }
      }
      conn.on('close', disconnected)
      conn.on('error', disconnected)
    })
  }
  async function join(name: string, code: string, token?: string) {
    try {
      const cleanCode = code.trim().toUpperCase()
      if (!/^[A-Z2-9]{6}$/.test(cleanCode) || !name.trim() || name.trim().length > 12) { fail('请输入昵称和 6 位房间码'); return }
      credentials = { role: 'guest', code: cleanCode, name: name.trim(), token: token ?? crypto.randomUUID() }
      const instance = await initialize()
      const conn = instance.connect(prefix + cleanCode, { reliable: true })
      hostConnection = conn
      timeout = setTimeout(() => { fail('连接房主超时，请确认房主在线或尝试其他网络'); conn.close() }, 18000)
      conn.on('open', () => conn.send({ type: 'join', name: credentials!.name, token: credentials!.token }))
      conn.on('data', raw => {
        const data = raw as { type: string; view?: RoomView; message?: string }
        if (data.type === 'state' && data.view) {
          view.value = data.view
          busy.value = false
          connected.value = true
          notice.value = ''
          error.value = ''
          clearTimeout(timeout)
          if (data.view.game?.finished) { localStorage.removeItem(storageKey); saved.value = false } else persist()
        }
        if (data.type === 'error') fail(data.message || '操作失败')
        if (data.type === 'end') {
          if (view.value) { view.value.ended = true; view.value.game = null }
          localStorage.removeItem(storageKey)
          saved.value = false
          notice.value = ''
        }
      })
      const disconnected = () => { connected.value = false; busy.value = false; clearTimeout(timeout); if (!view.value?.ended) notice.value = '与房主连接已断开，请重新连接' }
      conn.on('close', disconnected)
      conn.on('error', disconnected)
    } catch { /* initialize reports connection errors. */ }
  }
  async function resume() {
    const data = readSaved()
    if (!data) { saved.value = false; return }
    if (data.role === 'guest') { await join(data.name, data.code, data.token); return }
    try {
      credentials = data
      settings = data.settings!
      capacity = data.capacity!
      seats = data.seats!.map((s, i) => ({ ...s, online: data.role === 'solo' || i === 0 }))
      game = data.game ?? null
      lastMove = null
      if (data.role === 'solo') {
        dispose()
        connected.value = true
        busy.value = false
        error.value = ''
        notice.value = ''
        broadcast()
        return
      }
      const instance = await initialize(prefix + data.code)
      acceptConnections(instance)
      busy.value = false
      notice.value = ''
      broadcast()
    } catch { if (!error.value) fail('无法恢复房间，请重新开局') }
  }
  function start() {
    if (credentials?.role !== 'host' || game) return
    if (seats.length < 2 || seats.some(s => !s.online)) { fail('至少需要两名玩家，且所有玩家均在线'); return }
    game = createGame({ ...settings, names: seats.map(s => s.name) })
    lastMove = null
    broadcast()
  }
  function action(kind: 'fold' | 'call' | 'raise', amount = 0) {
    error.value = ''
    if (!view.value || !connected.value) return
    if ((credentials?.role === 'host' || credentials?.role === 'solo') && game && game.turn === 0) {
      try { takeAction(kind, amount); broadcast() } catch (err) { fail((err as Error).message) }
    } else if (view.value.game?.turn === view.value.me) {
      hostConnection?.send({ type: 'action', action: kind, amount, revision: view.value.revision })
    }
  }
  function next() {
    if ((credentials?.role === 'host' || credentials?.role === 'solo') && game && game.street === 'showdown' && !game.finished) {
      startRound(game)
      lastMove = null
      broadcast()
    }
  }
  function removeSeat(index: number) {
    if (credentials?.role !== 'host' || game || index < 1) return
    const token = seats[index]!.token
    const conn = connections.get(token)
    conn?.send({ type: 'end' })
    connections.delete(token)
    conn?.close()
    seats.splice(index, 1)
    broadcast()
  }
  function leave() {
    clearTimeout(botTimeout)
    clearTimeout(timeout)
    const retainGuest = credentials?.role === 'guest' && !view.value?.ended && !view.value?.game?.finished
    if (retainGuest) persist()
    if (credentials?.role === 'host') connections.forEach(conn => { if (conn.open) conn.send({ type: 'end' }) })
    // Let the reliable data channel flush the end message before closing it.
    const oldPeer = peer
    peer = null
    setTimeout(() => oldPeer?.destroy(), 300)
    connections = new Map()
    hostConnection = null
    credentials = null
    seats = []
    game = null
    lastMove = null
    view.value = null
    connected.value = false
    error.value = ''
    notice.value = ''
    if (!retainGuest) localStorage.removeItem(storageKey)
    saved.value = retainGuest
  }
  return { view, busy, error, notice, connected, saved, me, solo, host, join, resume, start, action, next, leave, removeSeat }
})

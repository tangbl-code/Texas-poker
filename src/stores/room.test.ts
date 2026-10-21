import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import Peer from 'peerjs'
import { useRoomStore } from './room'

vi.mock('peerjs', () => ({ default: vi.fn() }))
const options = { chips: 1000, rounds: 2, smallBlind: 10 }
let store: ReturnType<typeof useRoomStore>
let data: Map<string, string>
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  data = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  setActivePinia(createPinia())
  store = useRoomStore()
})
afterEach(() => { store.leave(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('solo rooms', () => {
  it('starts immediately with bots and hides their cards, without a network connection', async () => {
    store.solo('', options, 4)
    expect(store.view?.mode).toBe('solo')
    expect(store.view?.seats.filter(s => s.bot)).toHaveLength(3)
    expect(store.view?.game?.players[0]?.cards).toHaveLength(2)
    expect(store.view?.game?.players.slice(1).every(p => !p.cards.length)).toBe(true)
    const initialRevision = store.view!.revision
    await vi.advanceTimersByTimeAsync(1100)
    expect(store.view!.revision).toBeGreaterThan(initialRevision)
    expect(Peer).not.toHaveBeenCalled()
  })
  it('waits for the human and continues bots after a human action', async () => {
    store.solo('测试玩家', options, 2)
    expect(store.view!.game!.turn).toBe(0)
    const before = store.view!.revision
    await vi.advanceTimersByTimeAsync(5000)
    expect(store.view!.revision).toBe(before)
    store.action('call')
    await vi.advanceTimersByTimeAsync(1100)
    expect(store.view!.revision).toBeGreaterThan(before + 1)
  })
  it('restores the same hand and resumes bot turns locally', async () => {
    store.solo('玩家', options, 4)
    const cards = [...store.me!.cards]
    const cached = data.get('tablemates.active.v1')!
    store.leave()
    data.set('tablemates.active.v1', cached)
    setActivePinia(createPinia())
    store = useRoomStore()
    await store.resume()
    expect(store.me!.cards).toEqual(cards)
    expect(store.view!.mode).toBe('solo')
    expect(store.view!.seats.every(s => s.online)).toBe(true)
    const before = store.view!.revision
    await vi.advanceTimersByTimeAsync(1100)
    expect(store.view!.revision).toBeGreaterThan(before)
    expect(Peer).not.toHaveBeenCalled()
  })
  it('cancels pending bot actions and clears cache on exit', async () => {
    store.solo('玩家', options, 8)
    store.leave()
    await vi.advanceTimersByTimeAsync(10000)
    expect(store.view).toBeNull()
    expect(data.size).toBe(0)
  })
  it('clears finished games and allows the configured number of rounds', async () => {
    store.solo('玩家', options, 2)
    store.action('fold')
    expect(store.view!.game!.street).toBe('showdown')
    expect(store.view!.game!.finished).toBe(false)
    store.next()
    for (let step = 0; store.view!.game!.street !== 'showdown'; step++) {
      expect(step).toBeLessThan(100)
      if (store.view!.game!.turn === 0) store.action('call')
      await vi.advanceTimersByTimeAsync(1100)
    }
    expect(store.view!.game!.finished).toBe(true)
    expect(data.size).toBe(0)
    expect(store.view!.game!.players.reduce((sum, p) => sum + p.chips, 0)).toBe(2000)
  })
})

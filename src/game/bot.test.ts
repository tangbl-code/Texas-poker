import { describe, expect, it } from 'vitest'
import { chooseBotAction } from './bot'
import { act, createGame, pot, raiseAllowed, startRound, type Game } from './engine'

function rng(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}
const options = { names: ['玩家', '机器人 1', '机器人 2'], chips: 500, rounds: 3, smallBlind: 10 }
const chipsInPlay = (g: Game) => g.players.reduce((sum, p) => sum + p.chips, 0) + (g.street === 'showdown' ? 0 : pot(g))

describe('poker bots', () => {
  it('uses only its own hand and public information', () => {
    const g = createGame(options)
    const changed = structuredClone(g)
    changed.players.slice(1).forEach(p => { p.cards = ['As', 'Ah'] })
    changed.deck.reverse()
    const before = JSON.stringify(g)
    expect(chooseBotAction(g, rng(1234))).toEqual(chooseBotAction(changed, rng(1234)))
    expect(JSON.stringify(g)).toBe(before)
  })
  it('checks for free and does not fold with no amount to call', () => {
    const g = createGame(options)
    act(g, 'call'); act(g, 'call'); act(g, 'call')
    for (let i = 0; i < 10; i++) expect(chooseBotAction(g, rng(i + 1)).kind).not.toBe('fold')
  })
  it('plays legal actions through complete sessions with conserved chips', () => {
    for (const count of [2, 4, 8]) {
      const g = createGame({ ...options, names: Array.from({ length: count }, (_, i) => `P${i}`) })
      const random = rng(count * 100)
      let actions = 0
      while (!g.finished) {
        if (g.street === 'showdown') { startRound(g); continue }
        const decision = chooseBotAction(g, random)
        if (decision.kind === 'raise') expect(raiseAllowed(g)).toBe(true)
        act(g, decision.kind, decision.amount)
        expect(chipsInPlay(g)).toBe(count * options.chips)
        expect(++actions).toBeLessThan(500)
      }
    }
  })
})

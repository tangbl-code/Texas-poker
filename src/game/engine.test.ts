import { describe, expect, it } from 'vitest'
import { act, createGame, pot, raiseAllowed, roundProfit, startRound, type Game } from './engine'

const settings = { names: ['甲', '乙', '丙'], chips: 1000, rounds: 10, smallBlind: 10 }
const total = (g: Game) => g.players.reduce((n, p) => n + p.chips, 0) + (g.street === 'showdown' ? 0 : pot(g))

describe('dealing and betting order', () => {
  it('deals unique cards, collects blinds, and starts left of the big blind', () => {
    const g = createGame(settings)
    expect(g.turn).toBe(0)
    expect(g.smallBlind).toBe(1)
    expect(g.bigBlind).toBe(2)
    expect(pot(g)).toBe(30)
    expect(total(g)).toBe(3000)
    expect(new Set([...g.deck, ...g.players.flatMap(p => p.cards)]).size).toBe(52)
    act(g, 'call')
    expect(g.turn).toBe(1)
    act(g, 'call')
    expect(g.turn).toBe(2)
    expect(g.street).toBe('preflop')
    act(g, 'call')
    expect(g.street).toBe('flop')
    expect(g.board).toHaveLength(3)
    expect(g.turn).toBe(1)
  })
  it('uses dealer as the heads-up small blind and acts first preflop', () => {
    const g = createGame({ ...settings, names: ['甲', '乙'] })
    expect(g.smallBlind).toBe(0)
    expect(g.bigBlind).toBe(1)
    expect(g.turn).toBe(0)
    act(g, 'call'); act(g, 'call')
    expect(g.turn).toBe(1)
    while (g.street !== 'showdown') act(g, 'call')
    startRound(g)
    expect(g.dealer).toBe(1)
    expect(g.turn).toBe(1)
  })
  it('rejects invalid raises and preserves state', () => {
    const g = createGame(settings)
    const before = JSON.stringify(g)
    expect(() => act(g, 'raise', 21)).toThrow()
    expect(() => act(g, 'raise', 1001)).toThrow()
    expect(() => act(g, 'raise', NaN)).toThrow()
    expect(JSON.stringify(g)).toBe(before)
    act(g, 'raise', 60)
    expect(g.minRaise).toBe(40)
    expect(g.turn).toBe(1)
  })
  it('computes raise availability from public state with other hands redacted', () => {
    const g = createGame(settings)
    g.players[1]!.cards = []
    g.players[2]!.cards = []
    expect(raiseAllowed(g)).toBe(true)
  })
  it('does not reopen raising for a single short all-in', () => {
    const g = createGame(settings)
    g.players[2]!.chips = 10
    act(g, 'call')
    act(g, 'call')
    act(g, 'raise', 30)
    expect(g.turn).toBe(0)
    expect(raiseAllowed(g)).toBe(false)
    expect(() => act(g, 'raise', 60)).toThrow()
    act(g, 'call'); act(g, 'call')
    expect(g.street).toBe('flop')
  })
})

describe('settlement', () => {
  it('returns uncalled bets when everyone else folds', () => {
    const g = createGame(settings)
    act(g, 'raise', 100)
    act(g, 'fold'); act(g, 'fold')
    expect(g.street).toBe('showdown')
    expect(g.players[0]!.chips).toBe(1030)
    expect(total(g)).toBe(3000)
    expect(g.awards.some(a => a.description.startsWith('退回'))).toBe(true)
    expect(g.players.map(p => roundProfit(g, p))).toEqual([30, -10, -20])
  })
  it('builds main and side pots and returns unmatched chips', () => {
    const g = createGame({ ...settings, rounds: 1 })
    g.players[0]!.chips = 100
    g.players[1]!.chips = 190
    g.players[2]!.chips = 280
    g.players[0]!.cards = ['As', 'Ah']
    g.players[1]!.cards = ['Ks', 'Kh']
    g.players[2]!.cards = ['Qs', 'Qh']
    g.deck = ['9c', '4h', '8c', '3h', '2h', '7d', 'Jc', '6s']
    act(g, 'raise', 100)
    act(g, 'raise', 200)
    act(g, 'call')
    expect(g.street).toBe('showdown')
    expect(g.players.map(p => p.chips)).toEqual([300, 200, 100])
    expect(total(g)).toBe(600)
    expect(g.finished).toBe(true)
    expect(g.players.map(p => roundProfit(g, p))).toEqual([200, 0, -200])
  })
  it('splits tied pots and gives odd chips clockwise from dealer', () => {
    const g = createGame({ ...settings, smallBlind: 1, rounds: 1 })
    g.players[0]!.cards = ['2s', '3s']
    g.players[1]!.cards = ['4s', '5s']
    g.players[2]!.cards = ['6s', '7s']
    // A royal flush on board, with the third player's dead money.
    g.deck = ['Ah', '2d', 'Kh', '3d', 'Qh', 'Jh', 'Th', '4d']
    act(g, 'call')
    act(g, 'fold')
    act(g, 'call')
    while (g.street !== 'showdown') act(g, 'call')
    expect(g.players[0]!.chips).toBe(1000)
    expect(g.players[1]!.chips).toBe(999)
    expect(g.players[2]!.chips).toBe(1001)
    expect(total(g)).toBe(3000)
    expect(g.players.map(p => roundProfit(g, p))).toEqual([0, -1, 1])
  })
  it('reports the latest hand separately from cumulative profit', () => {
    const g = createGame({ ...settings, names: ['甲', '乙'] })
    act(g, 'fold')
    expect(g.players.map(p => roundProfit(g, p))).toEqual([-10, 10])
    startRound(g)
    act(g, 'raise', 100)
    act(g, 'fold')
    expect(g.round).toBe(2)
    expect(g.players.map(p => roundProfit(g, p))).toEqual([-20, 20])
    expect(g.players.map(p => p.chips - settings.chips)).toEqual([-30, 30])
    expect(g.players.reduce((sum, p) => sum + roundProfit(g, p), 0)).toBe(0)
  })
  it('runs the board when the big blind is short and nobody can contest more chips', () => {
    const g = createGame({ ...settings, names: ['甲', '乙'] })
    act(g, 'fold')
    g.players[0]!.chips = 5
    g.players[1]!.chips = 1995
    startRound(g)
    expect(g.street).toBe('showdown')
    expect(g.board).toHaveLength(5)
    expect(total(g)).toBe(2000)
  })
  it('stops at the configured round limit', () => {
    const g = createGame({ ...settings, rounds: 1 })
    act(g, 'fold'); act(g, 'fold')
    expect(g.finished).toBe(true)
    startRound(g)
    expect(g.round).toBe(1)
    expect(() => act(g, 'call')).toThrow()
  })
  it('conserves chips and terminates for varied legal actions across full sessions', () => {
    let seed = 91243
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
    for (let iteration = 0; iteration < 100; iteration++) {
      const count = 2 + iteration % 7
      const g = createGame({ ...settings, names: Array.from({ length: count }, (_, n) => `P${n}`), chips: 100 + iteration, rounds: 7 })
      let steps = 0
      while (!g.finished) {
        expect(total(g)).toBe(count * (100 + iteration))
        if (g.street === 'showdown') { startRound(g); continue }
        const p = g.players[g.turn]!
        expect(p.chips).toBeGreaterThan(0)
        expect(p.folded).toBe(false)
        const roll = random()
        if (roll < .2) act(g, 'fold')
        else if (roll > .6 && raiseAllowed(g) && p.chips + p.bet > g.currentBet) {
          const min = Math.min(p.chips + p.bet, g.currentBet + g.minRaise)
          act(g, 'raise', roll > .9 ? p.chips + p.bet : min)
        } else act(g, 'call')
        expect(++steps).toBeLessThan(2000)
      }
      expect(total(g)).toBe(count * (100 + iteration))
      expect(g.players.every(p => p.chips >= 0 && Number.isInteger(p.chips))).toBe(true)
    }
  })
})

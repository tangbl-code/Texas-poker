import solver from 'pokersolver'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export interface Player {
  id: number
  name: string
  chips: number
  cards: string[]
  folded: boolean
  bet: number
  invested: number
  acted: boolean
  actedAt: number
  lastAction: string
}
export interface Settings { names: string[]; chips: number; rounds: number; smallBlind: number }
export interface Award { playerId: number; amount: number; description: string }
export interface Game {
  settings: Settings
  players: Player[]
  deck: string[]
  board: string[]
  dealer: number
  smallBlind: number
  bigBlind: number
  turn: number
  round: number
  street: Street
  currentBet: number
  minRaise: number
  awards: Award[]
  finished: boolean
}

export const streetNames: Record<Street, string> = {
  preflop: '翻牌前', flop: '翻牌', turn: '转牌', river: '河牌', showdown: '本轮结算',
}
const live = (p: Player) => !p.folded
const canAct = (p: Player) => live(p) && p.chips > 0
export const pot = (g: Game) => g.players.reduce((sum, p) => sum + p.invested, 0)
export function nextSeat(g: Game, from: number, predicate: (p: Player) => boolean): number {
  for (let i = 1; i <= g.players.length; i++) {
    const seat = (from + i) % g.players.length
    if (predicate(g.players[seat]!)) return seat
  }
  return -1
}
function shuffle(): string[] {
  const cards = [...'23456789TJQKA'].flatMap(rank => [...'shdc'].map(suit => rank + suit))
  for (let i = cards.length - 1; i > 0; i--) {
    const range = i + 1
    const limit = 0x100000000 - (0x100000000 % range)
    let random: number
    do { random = crypto.getRandomValues(new Uint32Array(1))[0]! } while (random >= limit)
    const j = random % range
    ;[cards[i], cards[j]] = [cards[j]!, cards[i]!]
  }
  return cards
}
function pay(g: Game, index: number, amount: number) {
  const p = g.players[index]!
  const actual = Math.min(p.chips, amount)
  p.chips -= actual
  p.bet += actual
  p.invested += actual
}
export function createGame(settings: Settings): Game {
  if (settings.names.length < 2 || settings.names.length > 8 || settings.names.some(n => !n.trim() || n.length > 12)
    || !Number.isInteger(settings.chips) || settings.chips < 100 || settings.chips > 1000000
    || !Number.isInteger(settings.rounds) || settings.rounds < 1 || settings.rounds > 100
    || !Number.isInteger(settings.smallBlind) || settings.smallBlind < 1 || settings.smallBlind * 2 > settings.chips) {
    throw new Error('请检查玩家、筹码、轮数和盲注设置')
  }
  const g: Game = {
    settings: structuredClone(settings),
    players: settings.names.map((name, id) => ({ id, name: name.trim(), chips: settings.chips, cards: [], folded: false, bet: 0, invested: 0, acted: false, actedAt: 0, lastAction: '' })),
    deck: [], board: [], dealer: 0, smallBlind: 0, bigBlind: 1, turn: 0, round: 0,
    street: 'preflop', currentBet: 0, minRaise: settings.smallBlind * 2, awards: [], finished: false,
  }
  startRound(g)
  return g
}
export function startRound(g: Game) {
  if (g.round > 0 && g.street !== 'showdown') throw new Error('请先完成本轮')
  if (g.finished) return
  if (g.round > 0) g.dealer = nextSeat(g, g.dealer, p => p.chips > 0)
  g.round++
  g.deck = shuffle()
  g.board = []
  g.awards = []
  g.street = 'preflop'
  g.minRaise = g.settings.smallBlind * 2
  g.currentBet = g.minRaise
  for (const p of g.players) {
    Object.assign(p, { cards: [], folded: p.chips === 0, bet: 0, invested: 0, acted: false, actedAt: 0, lastAction: '' })
  }
  // Deal clockwise, one card per player on each pass.
  for (let pass = 0; pass < 2; pass++) {
    let seat = g.dealer
    for (let i = 0; i < g.players.filter(p => !p.folded).length; i++) {
      seat = nextSeat(g, seat, p => !p.folded)
      g.players[seat]!.cards.push(g.deck.pop()!)
    }
  }
  const headsUp = g.players.filter(live).length === 2
  g.smallBlind = headsUp ? g.dealer : nextSeat(g, g.dealer, live)
  g.bigBlind = nextSeat(g, g.smallBlind, live)
  pay(g, g.smallBlind, g.settings.smallBlind)
  pay(g, g.bigBlind, g.settings.smallBlind * 2)
  g.players[g.smallBlind]!.lastAction = '小盲'
  g.players[g.bigBlind]!.lastAction = '大盲'
  g.turn = g.bigBlind
  advance(g)
}
export function raiseAllowed(g: Game): boolean {
  const p = g.players[g.turn]
  return !!p && (!p.acted || g.currentBet - p.actedAt >= g.minRaise) && g.players.filter(canAct).length > 1
}
export function act(g: Game, action: 'fold' | 'call' | 'raise', raiseTo = 0) {
  if (g.street === 'showdown' || g.finished) throw new Error('本轮已结束')
  const p = g.players[g.turn]!
  if (!canAct(p)) throw new Error('当前玩家无法操作')
  if (action === 'fold') { p.folded = true; p.lastAction = '弃牌' }
  if (action === 'call') {
    const owed = Math.max(0, g.currentBet - p.bet)
    pay(g, g.turn, owed)
    p.lastAction = p.chips === 0 ? '全下' : owed ? '跟注' : '过牌'
  }
  if (action === 'raise') {
    const maximum = p.bet + p.chips
    if (!raiseAllowed(g) || !Number.isInteger(raiseTo) || raiseTo > maximum || raiseTo <= g.currentBet
      || (raiseTo < g.currentBet + g.minRaise && raiseTo !== maximum)) throw new Error('加注金额无效')
    const increase = raiseTo - g.currentBet
    if (increase >= g.minRaise) {
      g.minRaise = increase
      g.players.forEach(other => { if (other !== p && canAct(other)) other.acted = false })
    }
    pay(g, g.turn, raiseTo - p.bet)
    g.currentBet = raiseTo
    p.lastAction = p.chips === 0 ? '全下' : '加注'
  }
  p.acted = true
  p.actedAt = g.currentBet
  advance(g)
}
function advance(g: Game) {
  const remaining = g.players.filter(live)
  if (remaining.length === 1) { settle(g); return }
  const active = g.players.filter(canAct)
  const complete = active.every(p => p.acted && p.bet === g.currentBet)
  const noFurtherBetting = active.length <= 1 && active.every(p => p.bet >= Math.min(g.currentBet, Math.max(...remaining.filter(o => o !== p).map(o => o.bet)) ))
  if (complete || noFurtherBetting) {
    if (g.street === 'river') { settle(g); return }
    g.deck.pop() // Burn a card before each community-card street.
    const count = g.street === 'preflop' ? 3 : 1
    for (let i = 0; i < count; i++) g.board.push(g.deck.pop()!)
    g.street = g.street === 'preflop' ? 'flop' : g.street === 'flop' ? 'turn' : 'river'
    g.currentBet = 0
    g.minRaise = g.settings.smallBlind * 2
    g.players.forEach(p => { p.bet = 0; p.acted = false; p.actedAt = 0; if (canAct(p)) p.lastAction = '' })
    g.turn = nextSeat(g, g.dealer, canAct)
    if (active.length <= 1) advance(g)
  } else {
    g.turn = nextSeat(g, g.turn, p => canAct(p) && (!p.acted || p.bet < g.currentBet))
  }
}
function settle(g: Game) {
  const contenders = g.players.filter(live)
  const levels = [...new Set(g.players.map(p => p.invested).filter(n => n > 0))].sort((a, b) => a - b)
  let previous = 0
  for (const level of levels) {
    const contributors = g.players.filter(p => p.invested >= level)
    const amount = (level - previous) * contributors.length
    previous = level
    const eligible = contributors.filter(live)
    if (contributors.length === 1) {
      contributors[0]!.chips += amount
      g.awards.push({ playerId: contributors[0]!.id, amount, description: '退回未被跟注筹码' })
      continue
    }
    const hands = eligible.map(p => ({ p, hand: solver.Hand.solve([...p.cards, ...g.board]) }))
    const winningHands = contenders.length === 1 ? [] : solver.Hand.winners(hands.map(h => h.hand))
    const winners = contenders.length === 1 ? contenders : hands.filter(h => winningHands.includes(h.hand)).map(h => h.p)
    // Odd chips go clockwise from the dealer, preserving integer chips.
    winners.sort((a, b) => ((a.id - g.dealer - 1 + g.players.length) % g.players.length) - ((b.id - g.dealer - 1 + g.players.length) % g.players.length))
    for (let i = 0; i < winners.length; i++) {
      const p = winners[i]!
      const share = Math.floor(amount / winners.length) + (i < amount % winners.length ? 1 : 0)
      p.chips += share
      const hand = hands.find(h => h.p.id === p.id)?.hand
      g.awards.push({ playerId: p.id, amount: share, description: contenders.length === 1 ? '其余玩家弃牌' : hand?.descr ?? '获胜' })
    }
  }
  g.street = 'showdown'
  g.turn = -1
  g.finished = g.round >= g.settings.rounds || g.players.filter(p => p.chips > 0).length <= 1
}

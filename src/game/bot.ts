import solver from 'pokersolver'
import { pot, raiseAllowed, type Game } from './engine'

export interface BotAction { kind: 'fold' | 'call' | 'raise'; amount?: number }

export function chooseBotAction(g: Game, random: () => number = Math.random): BotAction {
  const player = g.players[g.turn]
  if (!player || player.folded || player.chips <= 0 || g.street === 'showdown') throw new Error('机器人当前无法行动')
  const opponents = g.players.filter(p => !p.folded && p.id !== player.id).length
  const known = new Set([...player.cards, ...g.board])
  const unseen = [...'23456789TJQKA'].flatMap(rank => [...'shdc'].map(suit => rank + suit)).filter(card => !known.has(card))
  let equity = 0
  const samples = 48
  // Sample unknown hands, never the actual opponents' cards or the saved deck.
  for (let sample = 0; sample < samples; sample++) {
    const deck = [...unseen]
    const draw = () => deck.splice(Math.floor(random() * deck.length), 1)[0]!
    const board = [...g.board]
    while (board.length < 5) board.push(draw())
    const mine = solver.Hand.solve([...player.cards, ...board])
    const hands = [mine]
    for (let i = 0; i < opponents; i++) hands.push(solver.Hand.solve([draw(), draw(), ...board]))
    const winners = solver.Hand.winners(hands)
    if (winners.includes(mine)) equity += 1 / winners.length
  }
  equity /= samples
  const owed = Math.min(player.chips, Math.max(0, g.currentBet - player.bet))
  const price = owed / Math.max(1, pot(g) + owed)
  const roll = random()
  if (owed > 0 && equity + 0.06 < price && roll > 0.12) return { kind: 'fold' }
  const maximum = player.bet + player.chips
  const aggressive = equity > Math.max(0.48, 1 / (opponents + 1) + 0.2)
  if (raiseAllowed(g) && maximum > g.currentBet && ((aggressive && roll < 0.65) || (owed === 0 && roll < 0.08))) {
    const target = Math.max(g.currentBet + g.minRaise, g.currentBet + Math.floor(pot(g) * (equity > 0.75 ? 0.75 : 0.5)))
    return { kind: 'raise', amount: Math.min(maximum, target) }
  }
  return { kind: 'call' }
}

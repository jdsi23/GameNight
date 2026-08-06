import { update } from 'firebase/database'
import { gameRef } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'

const MIN = -500
const MAX = 1000
const STARTING_ATTEMPTS = 3

// Numbers near 0 are common, numbers near the edges of the range are rare, and negatives are
// drawn slightly less often than positives. u^POWER pushed through Math.random() concentrates
// mass near 0 (bigger POWER = heavier nerf on large magnitudes); each side is capped at its own
// edge of the (asymmetric) range so a "large negative" and "large positive" mean different things.
const MAGNITUDE_POWER = 3.5
const NEGATIVE_CHANCE = 0.44

function randomNumber() {
  const negative = Math.random() < NEGATIVE_CHANCE
  const cap = negative ? Math.abs(MIN) : MAX
  const magnitude = Math.round(Math.pow(Math.random(), MAGNITUDE_POWER) * cap)
  if (magnitude === 0) return 0
  return negative ? -magnitude : magnitude
}

/** Attempted by any client once it sees an empty game node for this room. */
export async function setupRound(code, uids) {
  if (uids.length === 0) return
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return // someone already set this round up
    const numbers = {}
    const attemptsLeft = {}
    const status = {}
    for (const uid of uids) {
      numbers[uid] = randomNumber()
      attemptsLeft[uid] = STARTING_ATTEMPTS
      status[uid] = 'active'
    }
    return {
      phase: 'discuss',
      numbers,
      attemptsLeft,
      status,
      ready: {},
      guesses: [],
    }
  })
}

/** Any client may flip discuss -> guessing once majority-ready is reached. */
export async function beginGuessing(code) {
  await update(gameRef(code), { phase: 'guessing' })
}

/**
 * Anyone can guess at any time (no turn order) as long as they still have tries left.
 * Guesses are logged anonymously — the value and whether it was right, never who made it —
 * and stay visible on screen for the rest of the round.
 */
export async function submitGuess(code, uid, guessValue) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'guessing') return
    if (current.status[uid] !== 'active') return

    const correct = current.numbers[uid] === guessValue
    const nextStatus = { ...current.status }
    const nextAttempts = { ...current.attemptsLeft }

    if (correct) {
      nextStatus[uid] = 'won'
    } else {
      const remaining = (current.attemptsLeft[uid] ?? STARTING_ATTEMPTS) - 1
      nextAttempts[uid] = remaining
      if (remaining <= 0) nextStatus[uid] = 'lost'
    }

    const guesses = [...(current.guesses ?? []), { value: guessValue, correct }]
    const allResolved = Object.values(nextStatus).every((s) => s !== 'active')

    return {
      ...current,
      status: nextStatus,
      attemptsLeft: nextAttempts,
      guesses,
      phase: allResolved ? 'complete' : 'guessing',
    }
  })
}

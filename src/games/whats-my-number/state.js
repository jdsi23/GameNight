import { update } from 'firebase/database'
import { gameRef, shuffle } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'

const MAX_MAGNITUDE = 2500
const STARTING_ATTEMPTS = 3

// Numbers near 0 are common, numbers near +/-2500 are rare, and negatives are drawn
// slightly less often than positives. u^POWER pushed through Math.random() concentrates
// mass near 0 (bigger POWER = heavier nerf on large magnitudes); the sign roll is skewed
// so negative numbers come up a bit less than positive ones.
const MAGNITUDE_POWER = 3.5
const NEGATIVE_CHANCE = 0.44

function randomNumber() {
  const magnitude = Math.round(Math.pow(Math.random(), MAGNITUDE_POWER) * MAX_MAGNITUDE)
  if (magnitude === 0) return 0
  return Math.random() < NEGATIVE_CHANCE ? -magnitude : magnitude
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
      turnOrder: shuffle(uids),
      turnIndex: 0,
      attemptsLeft,
      status,
      ready: {},
      log: [],
    }
  })
}

/** Any client may flip discuss -> guessing once majority-ready is reached. */
export async function beginGuessing(code) {
  await update(gameRef(code), { phase: 'guessing' })
}

/** Only meaningful when called by the player whose turn it is; the transaction re-checks. */
export async function submitGuess(code, uid, guessValue) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'guessing') return
    const turnUid = current.turnOrder[current.turnIndex]
    if (turnUid !== uid) return

    const correct = current.numbers[turnUid] === guessValue
    const nextStatus = { ...current.status }
    const nextAttempts = { ...current.attemptsLeft }

    if (correct) {
      nextStatus[turnUid] = 'won'
    } else {
      const remaining = (current.attemptsLeft[turnUid] ?? STARTING_ATTEMPTS) - 1
      nextAttempts[turnUid] = remaining
      if (remaining <= 0) nextStatus[turnUid] = 'lost'
    }

    const order = current.turnOrder
    let nextIndex = current.turnIndex
    let foundNext = false
    for (let step = 1; step <= order.length; step++) {
      const candidateIdx = (current.turnIndex + step) % order.length
      if (nextStatus[order[candidateIdx]] === 'active') {
        nextIndex = candidateIdx
        foundNext = true
        break
      }
    }

    const log = [...(current.log ?? []), { uid: turnUid, guess: guessValue, correct }]

    return {
      ...current,
      status: nextStatus,
      attemptsLeft: nextAttempts,
      turnIndex: nextIndex,
      phase: foundNext ? 'guessing' : 'complete',
      log,
    }
  })
}

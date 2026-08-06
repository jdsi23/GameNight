import { ref, update } from 'firebase/database'
import { db } from '../../lib/firebase'
import { gameRef, randomInt } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'
import { CHARACTERS } from './characters'

export const COURSE_WIDTH = 7
export const START_COL = Math.floor(COURSE_WIDTH / 2)
export const FINISH_ROW = 60
export const COUNTDOWN_MS = 3000
export const ROUND_MS = 2 * 60 * 1000
export const RESPAWN_MS = 1500
export const INVINCIBLE_MS = 250
export const RESPAWN_SETBACK_ROWS = 4
export const MOVE_COOLDOWN_MS = 300

/** Attempted by any client once it sees an empty game node — sets up character select. */
export async function setupLobby(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    return { phase: 'select', ready: {}, characters: {} }
  })
}

export async function pickCharacter(code, uid, characterId) {
  await update(ref(db, `rooms/${code}/game/characters`), { [uid]: characterId })
}

/** Any client may flip select -> countdown once majority-ready is reached. */
export async function beginCountdown(code, uids) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'select') return
    const blockerUid = uids[randomInt(0, uids.length - 1)]
    const runners = uids.filter((u) => u !== blockerUid)
    const positions = {}
    runners.forEach((uid) => {
      positions[uid] = {
        row: 0,
        col: START_COL,
        status: 'active',
        invincibleUntil: 0,
        updatedAt: Date.now(),
      }
    })
    // Anyone who readied up without picking a character gets a random default.
    const characters = { ...current.characters }
    uids.forEach((uid) => {
      if (!characters[uid]) characters[uid] = CHARACTERS[randomInt(0, CHARACTERS.length - 1)].id
    })
    return {
      ...current,
      phase: 'countdown',
      seed: Math.floor(Math.random() * 1_000_000_000),
      blockerUid,
      characters,
      countdownEndsAt: Date.now() + COUNTDOWN_MS,
      positions,
    }
  })
}

/** Any client flips countdown -> playing once the countdown timestamp has passed. */
export async function beginPlaying(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'countdown') return
    const now = Date.now()
    return { ...current, phase: 'playing', roundStartAt: now, timerEndsAt: now + ROUND_MS }
  })
}

export async function movePlayer(code, uid, row, col) {
  await update(ref(db, `rooms/${code}/game/positions/${uid}`), {
    row,
    col,
    status: 'active',
    updatedAt: Date.now(),
  })
}

export async function respawnPlayer(code, uid, row, col) {
  await update(ref(db, `rooms/${code}/game/positions/${uid}`), {
    row,
    col,
    status: 'active',
    invincibleUntil: Date.now() + INVINCIBLE_MS,
    updatedAt: Date.now(),
  })
}

export async function markRespawning(code, uid) {
  await update(ref(db, `rooms/${code}/game/positions/${uid}`), {
    status: 'respawning',
    updatedAt: Date.now(),
  })
}

/** Race-safe: only the first call for a given uid actually appends them to the results. */
export async function finishPlayer(code, uid) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'playing') return
    const order = current.finishedOrder ?? []
    if (order.includes(uid)) return
    const positions = {
      ...current.positions,
      [uid]: { ...current.positions[uid], status: 'finished' },
    }
    return { ...current, finishedOrder: [...order, uid], positions }
  })
}

/**
 * The Blocker's attacks are player-locked, guaranteed hits on the chosen runner, not an
 * area/row effect that may or may not land — the target's own client is the one that actually
 * carries out the effect (see RunnerView) so it plays out with the same respawn timing as a
 * normal traffic hit instead of just teleporting them. This is a transaction (not a plain write)
 * because Fire also needs the target's row *at the moment of the attack* so it can ignite that
 * row for everyone else too, not just guarantee-hit the original target.
 */
export async function triggerAttack(code, type, targetUid) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current) return
    const row = current.positions?.[targetUid]?.row ?? 0
    return {
      ...current,
      blockerAbility: {
        ...(current.blockerAbility ?? {}),
        [type]: { targetUid, row, triggeredAt: Date.now() },
      },
    }
  })
}

/** Any client flips playing -> results once the timer runs out or every runner has finished. */
export async function endRound(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'playing') return
    return { ...current, phase: 'results' }
  })
}

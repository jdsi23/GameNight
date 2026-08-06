import { ref, update } from 'firebase/database'
import { db } from '../../lib/firebase'
import { gameRef, randomInt } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'
import { topicPool } from './topics'

export const DISCUSSION_MS = 5 * 60 * 1000

/** Attempted by any client once it sees an empty game node — sets up the category-select lobby. */
export async function setupLobby(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    return { phase: 'lobby', topicCategory: 'random', ready: {} }
  })
}

/** Host-only in the UI; which topic category (or "random") the round will draw from. */
export async function setTopicCategory(code, categoryId) {
  await update(gameRef(code), { topicCategory: categoryId })
}

/** Any client may flip lobby -> discussion once majority-ready is reached; reads category live. */
export async function beginRound(code, uids) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'lobby') return
    const pool = topicPool(current.topicCategory)
    const holderUid = uids[randomInt(0, uids.length - 1)]
    const topic = pool[randomInt(0, pool.length - 1)]
    const alignment = Math.random() < 0.5 ? 'good' : 'evil'
    return {
      phase: 'discussion',
      topicCategory: current.topicCategory,
      holderUid,
      topic,
      alignment,
      timerEndsAt: Date.now() + DISCUSSION_MS,
      ready: {},
      votes: {},
    }
  })
}

/** Any client may flip discussion -> voting once the timer runs out or majority is ready. */
export async function endDiscussion(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'discussion') return
    return { ...current, phase: 'voting' }
  })
}

export async function castVote(code, uid, alignment) {
  await update(ref(db, `rooms/${code}/game/votes`), { [uid]: alignment })
}

/** Any client may flip voting -> reveal once every non-holder player has voted. */
export async function finishVoting(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'voting') return
    return { ...current, phase: 'reveal' }
  })
}

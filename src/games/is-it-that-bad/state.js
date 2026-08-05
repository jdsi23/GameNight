import { ref, update } from 'firebase/database'
import { db } from '../../lib/firebase'
import { gameRef, randomInt } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'
import { TOPICS } from './topics'

export const DISCUSSION_MS = 5 * 60 * 1000

export async function setupRound(code, uids) {
  if (uids.length === 0) return
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    const holderUid = uids[randomInt(0, uids.length - 1)]
    const topic = TOPICS[randomInt(0, TOPICS.length - 1)]
    const alignment = Math.random() < 0.5 ? 'good' : 'evil'
    return {
      phase: 'discussion',
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

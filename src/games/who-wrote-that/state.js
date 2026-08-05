import { ref, update } from 'firebase/database'
import { db } from '../../lib/firebase'
import { gameRef, randomInt, shuffle } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'
import { TEXTS } from './texts'

export async function setupRound(code, uids) {
  if (uids.length === 0) return
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    const source = TEXTS[randomInt(0, TEXTS.length - 1)]
    const editableIds = source.parts.filter((p) => p.type === 'editable').map((p) => p.id)
    const assignmentOrder = shuffle(editableIds)
    const shuffledUids = shuffle(uids)

    const segments = {}
    source.parts
      .filter((p) => p.type === 'editable')
      .forEach((p) => {
        segments[p.id] = {
          original: p.original,
          current: p.original,
          claimedBy: null,
          filled: false,
        }
      })
    assignmentOrder.forEach((segId, i) => {
      if (i < shuffledUids.length) {
        segments[segId].claimedBy = shuffledUids[i]
      }
    })

    return { phase: 'editing', textId: source.id, segments }
  })
}

/** First-come-first-served claim of a still-open segment. */
export async function claimSegment(code, segmentId, uid) {
  await attemptTransaction(ref(db, `rooms/${code}/game/segments/${segmentId}`), (current) => {
    if (!current || current.claimedBy) return
    return { ...current, claimedBy: uid }
  })
}

export async function submitSegment(code, segmentId, newText) {
  await update(ref(db, `rooms/${code}/game/segments/${segmentId}`), {
    current: newText,
    filled: true,
  })
}

/** Any client checks whether every segment is filled and flips the round to reveal. */
export async function checkRoundComplete(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'editing') return
    const allFilled = Object.values(current.segments).every((s) => s.filled)
    if (!allFilled) return
    return { ...current, phase: 'reveal' }
  })
}

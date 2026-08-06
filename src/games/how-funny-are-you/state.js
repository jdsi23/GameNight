import { ref, update } from 'firebase/database'
import { db } from '../../lib/firebase'
import { gameRef, randomInt, shuffle } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'
import { FILL_BLANK_TEMPLATES, PROMPT_TYPES } from './prompts'

const FLOOR_TRIGGER_SCORE = 15

function randomPrompt() {
  const type = PROMPT_TYPES[randomInt(0, PROMPT_TYPES.length - 1)]
  const prompt =
    type.id === 'fill-blank'
      ? FILL_BLANK_TEMPLATES[randomInt(0, FILL_BLANK_TEMPLATES.length - 1)]
      : type.label
  return { type: type.id, prompt }
}

function buildSubmissions(uids) {
  const submissions = {}
  uids.forEach((uid) => {
    submissions[uid] = { ...randomPrompt(), joke: '', submitted: false }
  })
  return submissions
}

/** Next index in playerOrder (wrapping) whose player isn't eliminated. */
function nextActiveIndex(playerOrder, eliminated, fromIndex) {
  const elim = eliminated ?? {}
  for (let step = 1; step <= playerOrder.length; step++) {
    const idx = (fromIndex + step) % playerOrder.length
    if (!elim[playerOrder[idx]]) return idx
  }
  return fromIndex
}

export async function setupGame(code, uids) {
  if (uids.length === 0) return
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    const playerOrder = shuffle(uids)
    const judgeIndex = 0
    const judgeUid = playerOrder[judgeIndex]
    const nonJudge = playerOrder.filter((u) => u !== judgeUid)
    const scores = {}
    uids.forEach((uid) => {
      scores[uid] = 0
    })
    return {
      phase: 'submitting',
      round: 1,
      playerOrder,
      judgeIndex,
      scores,
      eliminated: {},
      floorActive: false,
      floorValue: null,
      submissions: buildSubmissions(nonJudge),
      judgingOrder: [],
      judgingIndex: 0,
      lastRatings: {},
    }
  })
}

export async function submitJoke(code, uid, joke) {
  await update(ref(db, `rooms/${code}/game/submissions/${uid}`), {
    joke,
    submitted: true,
  })
}

/** Any client checks whether every active non-judge player has submitted their joke. */
export async function checkAllSubmitted(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'submitting') return
    const submitters = Object.keys(current.submissions ?? {})
    if (submitters.length === 0) return
    const allDone = submitters.every((uid) => current.submissions[uid].submitted)
    if (!allDone) return
    return {
      ...current,
      phase: 'judging',
      judgingOrder: shuffle(submitters),
      judgingIndex: 0,
      lastRatings: {},
    }
  })
}

/** Only meaningful when called by the current judge for the current submission; re-checked. */
export async function submitRating(code, judgeUid, ratedUid, rating) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'judging') return
    const currentJudge = current.playerOrder[current.judgeIndex]
    if (currentJudge !== judgeUid) return
    const judgingOrder = current.judgingOrder ?? []
    if (judgingOrder[current.judgingIndex] !== ratedUid) return

    const scores = { ...current.scores, [ratedUid]: (current.scores[ratedUid] ?? 0) + rating }
    const lastRatings = { ...current.lastRatings, [ratedUid]: rating }
    const nextIndex = current.judgingIndex + 1

    if (nextIndex < judgingOrder.length) {
      return { ...current, scores, lastRatings, judgingIndex: nextIndex }
    }

    // Round's ratings are done — evaluate the rising floor.
    const currentEliminated = current.eliminated ?? {}
    const activeUids = current.playerOrder.filter((u) => !currentEliminated[u])
    const maxScore = Math.max(...activeUids.map((u) => scores[u] ?? 0))
    const floorActive = current.floorActive || maxScore >= FLOOR_TRIGGER_SCORE

    const eliminated = { ...currentEliminated }
    // Firebase transactions reject a return value containing an explicit `undefined` (as
    // opposed to a simply-missing key), which is exactly what current.floorValue would be
    // before it's ever been set — RTDB drops null/never-set fields on read, it doesn't keep
    // them as null. Default to null so this is always a valid, explicit value.
    let floorValue = current.floorValue ?? null
    if (floorActive) {
      const avg = activeUids.reduce((sum, u) => sum + (scores[u] ?? 0), 0) / activeUids.length
      floorValue = avg
      activeUids.forEach((u) => {
        if ((scores[u] ?? 0) < avg) eliminated[u] = true
      })
    }

    const stillActive = current.playerOrder.filter((u) => !eliminated[u])
    const phase = stillActive.length <= 1 ? 'complete' : 'roundEnd'

    return {
      ...current,
      scores,
      lastRatings,
      eliminated,
      floorActive,
      floorValue,
      judgingIndex: nextIndex,
      phase,
    }
  })
}

/** Advances to the next round: rotates judge, rebuilds prompts for active non-judge players. */
export async function nextRound(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'roundEnd') return
    const currentEliminated = current.eliminated ?? {}
    const judgeIndex = nextActiveIndex(current.playerOrder, currentEliminated, current.judgeIndex)
    const judgeUid = current.playerOrder[judgeIndex]
    const nonJudgeActive = current.playerOrder.filter(
      (u) => u !== judgeUid && !currentEliminated[u]
    )
    return {
      ...current,
      phase: 'submitting',
      round: current.round + 1,
      judgeIndex,
      submissions: buildSubmissions(nonJudgeActive),
      judgingOrder: [],
      judgingIndex: 0,
      lastRatings: {},
    }
  })
}

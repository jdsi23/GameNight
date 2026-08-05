import { ref, update } from 'firebase/database'
import { db } from '../../lib/firebase'
import { gameRef, randomInt, shuffle } from '../../lib/gameUtils'
import { attemptTransaction } from '../../lib/transactions'
import { PARAGRAPHS } from './texts'

const TARGET_EDITABLE_COUNT = 10

/** Splits on whitespace while keeping the whitespace itself as tokens, so rejoining is lossless. */
function tokenize(paragraph) {
  return paragraph.split(/(\s+)/).filter((t) => t.length > 0)
}

/** Builds a fresh { parts, segments } pair with a random paragraph and random editable words. */
function buildRound(uids) {
  const paragraph = PARAGRAPHS[randomInt(0, PARAGRAPHS.length - 1)]
  const tokens = tokenize(paragraph)

  const wordIndices = tokens
    .map((t, i) => ({ t, i }))
    .filter((o) => o.t.trim().length > 0)

  // Prefer meatier words for comedic effect; only fall back to short ones if there aren't
  // enough long ones in this particular paragraph.
  const longWordIndices = wordIndices.filter((o) => o.t.replace(/[^a-zA-Z]/g, '').length >= 3)
  const pool = longWordIndices.length >= TARGET_EDITABLE_COUNT ? longWordIndices : wordIndices

  const chosenIndices = new Set(
    shuffle(pool.map((o) => o.i)).slice(0, Math.min(TARGET_EDITABLE_COUNT, pool.length))
  )

  const parts = []
  const segments = {}
  let textBuffer = ''
  let segCount = 0

  const flush = () => {
    if (textBuffer) {
      parts.push({ type: 'text', value: textBuffer })
      textBuffer = ''
    }
  }

  tokens.forEach((token, i) => {
    if (chosenIndices.has(i)) {
      flush()
      const id = `s${segCount++}`
      parts.push({ type: 'editable', id })
      segments[id] = { original: token, current: token, claimedBy: null, filled: false }
    } else {
      textBuffer += token
    }
  })
  flush()

  const editableIds = Object.keys(segments)
  const shuffledUids = shuffle(uids)
  shuffle(editableIds).forEach((id, i) => {
    if (i < shuffledUids.length) segments[id].claimedBy = shuffledUids[i]
  })

  return { parts, segments }
}

export async function setupRound(code, uids) {
  if (uids.length === 0) return
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    const { parts, segments } = buildRound(uids)
    return { phase: 'editing', parts, segments }
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

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

/** Turns one random paragraph into { parts, segments } with ~10 random editable words marked. */
function buildParagraph() {
  const paragraph = PARAGRAPHS[randomInt(0, PARAGRAPHS.length - 1)]
  const tokens = tokenize(paragraph)

  const wordIndices = tokens.map((t, i) => ({ t, i })).filter((o) => o.t.trim().length > 0)

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
      segments[id] = { original: token, current: token, filled: false }
    } else {
      textBuffer += token
    }
  })
  flush()

  return { parts, segments }
}

/** Assigns each of a shared paragraph's segments to one player (Group Mode). */
function buildGroupRound(uids) {
  const { parts, segments } = buildParagraph()
  const editableIds = Object.keys(segments)
  const shuffledUids = shuffle(uids)
  shuffle(editableIds).forEach((id, i) => {
    segments[id].claimedBy = i < shuffledUids.length ? shuffledUids[i] : null
  })
  return { parts, segments }
}

/** Every player gets their own separate paragraph, fully theirs to edit (Traditional mode). */
function buildTraditionalRound(uids) {
  const paragraphs = {}
  for (const uid of uids) {
    paragraphs[uid] = buildParagraph()
  }
  return paragraphs
}

/** Attempted by any client once it sees an empty game node — sets up the mode-select lobby. */
export async function setupLobby(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (current) return
    return { phase: 'lobby', groupMode: false, ready: {} }
  })
}

/** Host-only in the UI; toggles which mode will be used once the round starts. */
export async function setGroupMode(code, groupMode) {
  await update(gameRef(code), { groupMode })
}

/** Any client may flip lobby -> editing once majority-ready is reached; reads groupMode live. */
export async function beginRound(code, uids) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'lobby') return
    if (current.groupMode) {
      const { parts, segments } = buildGroupRound(uids)
      return { phase: 'editing', mode: 'group', parts, segments }
    }
    const paragraphs = buildTraditionalRound(uids)
    return { phase: 'editing', mode: 'traditional', paragraphs, doneReady: {} }
  })
}

// ---------- Group Mode ----------

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
export async function checkGroupRoundComplete(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'editing' || current.mode !== 'group') return
    const allFilled = Object.values(current.segments).every((s) => s.filled)
    if (!allFilled) return
    return { ...current, phase: 'reveal' }
  })
}

// ---------- Traditional Mode ----------

export async function submitTraditionalSegment(code, uid, segmentId, newText) {
  await update(ref(db, `rooms/${code}/game/paragraphs/${uid}/segments/${segmentId}`), {
    current: newText,
    filled: true,
  })
}

/** Any client checks whether every player has finished their own paragraph. */
export async function checkTraditionalEditingComplete(code) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'editing' || current.mode !== 'traditional') return
    const allDone = Object.values(current.paragraphs).every((p) =>
      Object.values(p.segments).every((s) => s.filled)
    )
    if (!allDone) return
    return { ...current, phase: 'voting', thumbsVotes: {}, guesses: {} }
  })
}

/** Majority-ready override in case someone stalls out on their paragraph. */
export async function forceAdvanceToVoting(code) {
  await update(gameRef(code), { phase: 'voting', thumbsVotes: {}, guesses: {} })
}

export async function castThumbs(code, ownerUid, voterUid, value) {
  await update(ref(db, `rooms/${code}/game/thumbsVotes/${ownerUid}`), { [voterUid]: value })
}

export async function castAuthorGuess(code, ownerUid, voterUid, guessedUid) {
  await update(ref(db, `rooms/${code}/game/guesses/${ownerUid}`), { [voterUid]: guessedUid })
}

/** Any client checks whether every player has voted+guessed on every other player's paragraph. */
export async function checkVotingComplete(code, uids) {
  await attemptTransaction(gameRef(code), (current) => {
    if (!current || current.phase !== 'voting') return
    const allDone = uids.every((ownerUid) => {
      const others = uids.filter((u) => u !== ownerUid)
      const votes = current.thumbsVotes?.[ownerUid] ?? {}
      const guesses = current.guesses?.[ownerUid] ?? {}
      return others.every((voterUid) => votes[voterUid] && guesses[voterUid])
    })
    if (!allDone) return
    return { ...current, phase: 'reveal' }
  })
}

/** Pure function: derives final scores from synced vote/guess data. Traditional mode only. */
export function computeTraditionalScores(paragraphs, thumbsVotes, guesses, uids) {
  const scores = {}
  uids.forEach((uid) => {
    scores[uid] = 0
  })

  const upCounts = {}
  uids.forEach((uid) => {
    upCounts[uid] = Object.values(thumbsVotes?.[uid] ?? {}).filter((v) => v === 'up').length
  })
  const maxUp = Math.max(0, ...Object.values(upCounts))
  if (maxUp > 0) {
    const topUids = uids.filter((uid) => upCounts[uid] === maxUp)
    if (topUids.length === 1) {
      scores[topUids[0]] += 3
    } else {
      topUids.forEach((uid) => {
        scores[uid] += 2
      })
    }
  }

  uids.forEach((ownerUid) => {
    const ownerGuesses = guesses?.[ownerUid] ?? {}
    Object.entries(ownerGuesses).forEach(([voterUid, guessedUid]) => {
      if (guessedUid === ownerUid && scores[voterUid] !== undefined) {
        scores[voterUid] += 1
      }
    })
  })

  return { scores, upCounts }
}

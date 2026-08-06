import { ref, set } from 'firebase/database'
import { db } from './firebase'

/**
 * Shared "I'm Ready" majority-vote math, used by every ready-gate across all games.
 * Ready flags live at rooms/{code}/game/{field}/{uid} (default field "ready") so they're
 * wiped for free whenever the game node resets (new round / play again) — pass in the
 * already-synced `game[field]` object from useRoom rather than opening a second listener.
 * A game with more than one ready-gate (e.g. Who Wrote That's Traditional mode) uses a
 * second field name to keep the two votes independent.
 */
export function getReadyStatus(readyMap, connectedCount) {
  const readyCount = Object.values(readyMap ?? {}).filter(Boolean).length
  const requiredCount = Math.floor(connectedCount / 2) + 1
  return {
    readyCount,
    requiredCount,
    majorityReached: connectedCount > 0 && readyCount >= requiredCount,
  }
}

export function readyRef(code, uid, field = 'ready') {
  return ref(db, `rooms/${code}/game/${field}/${uid}`)
}

export async function setPlayerReady(code, uid, ready, field = 'ready') {
  await set(readyRef(code, uid, field), ready)
}

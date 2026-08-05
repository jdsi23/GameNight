import { ref, set } from 'firebase/database'
import { db } from './firebase'

/**
 * Shared "I'm Ready" majority-vote math, used by all three games.
 * Ready flags live at rooms/{code}/game/ready/{uid} so they're wiped for free whenever
 * the game node resets (new round / play again) — pass in the already-synced `game.ready`
 * object from useRoom rather than opening a second listener.
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

export function readyRef(code, uid) {
  return ref(db, `rooms/${code}/game/ready/${uid}`)
}

export async function setPlayerReady(code, uid, ready) {
  await set(readyRef(code, uid), ready)
}

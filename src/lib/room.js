import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database'
import { db } from './firebase'
import { generateRoomCode } from './roomCode'

const MAX_CREATE_ATTEMPTS = 8

export function roomRef(code) {
  return ref(db, `rooms/${code}`)
}

export function playerRef(code, uid) {
  return ref(db, `rooms/${code}/players/${uid}`)
}

export function hostUidRef(code) {
  return ref(db, `rooms/${code}/meta/hostUid`)
}

/**
 * Creates a new room with a fresh code and makes `uid` the host. Returns the room code.
 *
 * This has to be three *sequential, separately-awaited* writes rather than one multi-path
 * update(): the `hostUid` rule requires the claimer to already be a room member, and the
 * `status`/`gameId` rules require the *current* `hostUid` to match the caller. Whether a
 * security rule's `root` reliably sees sibling paths from the same multi-location update is
 * not something to rely on — each write below only ever reads data that a *previous, already
 * -committed* write produced, so every rule check is unambiguous.
 */
export async function createRoom(uid, nickname) {
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const code = generateRoomCode()
    const metaRef = ref(db, `rooms/${code}/meta`)
    const existing = await get(metaRef)
    if (existing.exists()) continue

    await set(playerRef(code, uid), {
      name: nickname,
      joinedAt: serverTimestamp(),
      connected: true,
    })
    await set(hostUidRef(code), uid)
    await update(metaRef, {
      status: 'lobby',
      gameId: null,
      createdAt: serverTimestamp(),
    })
    onDisconnect(hostUidRef(code)).set(null)
    return code
  }
  throw new Error('Could not generate a free room code, please try again.')
}

/** Joins an existing room as a non-host player. Throws if the room doesn't exist. */
export async function joinRoom(code, uid, nickname) {
  const metaSnap = await get(ref(db, `rooms/${code}/meta`))
  if (!metaSnap.exists()) {
    throw new Error(`Room "${code}" was not found.`)
  }
  await set(playerRef(code, uid), {
    name: nickname,
    joinedAt: serverTimestamp(),
    connected: true,
  })
  return code
}

/**
 * Keeps players/{uid}/connected accurate across reconnects, and lets this client
 * take over as host if hostUid is currently empty — whether because the previous host
 * disconnected (detected on our own reconnect) or explicitly left (detected live).
 */
export function setupPresence(code, uid) {
  const connectedRef = ref(db, '.info/connected')
  const myConnectedRef = ref(db, `rooms/${code}/players/${uid}/connected`)

  const unsubConnected = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return
    onDisconnect(myConnectedRef).set(false)
    set(myConnectedRef, true)
    attemptClaimHost(code, uid)
  })

  const unsubHost = onValue(hostUidRef(code), (snap) => {
    if (!snap.val()) attemptClaimHost(code, uid)
  })

  return () => {
    unsubConnected()
    unsubHost()
  }
}

/** Attempts to become host if no host currently holds the room. Silently no-ops if it loses the race. */
export async function attemptClaimHost(code, uid) {
  try {
    const snap = await get(hostUidRef(code))
    if (snap.exists() && snap.val()) return
    await set(hostUidRef(code), uid)
    onDisconnect(hostUidRef(code)).set(null)
  } catch {
    // Another client won the race, or rules rejected us (e.g. we're not a room member yet). Fine.
  }
}

/** Explicit leave (as opposed to a disconnect): removes the player and releases host if held. */
export async function leaveRoom(code, uid) {
  onDisconnect(playerRef(code, uid)).cancel()
  onDisconnect(hostUidRef(code)).cancel()

  const hostSnap = await get(hostUidRef(code))
  if (hostSnap.val() === uid) {
    await set(hostUidRef(code), null)
  }
  await remove(playerRef(code, uid))
}

export async function startGame(code, gameId) {
  await set(ref(db, `rooms/${code}/game`), null)
  await update(ref(db, `rooms/${code}/meta`), {
    gameId,
    status: 'in-game',
  })
}

/** Replays the same game fresh (used by the "Play Again" screen). */
export async function replayGame(code, gameId) {
  await set(ref(db, `rooms/${code}/game`), null)
  await update(ref(db, `rooms/${code}/meta`), { gameId, status: 'in-game' })
}

export async function returnToLobby(code) {
  await set(ref(db, `rooms/${code}/game`), null)
  await update(ref(db, `rooms/${code}/meta`), {
    gameId: null,
    status: 'lobby',
  })
}

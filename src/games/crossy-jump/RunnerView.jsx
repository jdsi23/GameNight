import { useEffect, useRef, useState } from 'react'
import { ATTACKS } from './attacks'
import { characterEmoji } from './characters'
import { carColumnsAt, getLane } from './course'
import {
  COURSE_WIDTH,
  FINISH_ROW,
  MOVE_COOLDOWN_MS,
  RESPAWN_MS,
  RESPAWN_SETBACK_ROWS,
  START_COL,
  finishPlayer,
  markRespawning,
  movePlayer,
  respawnPlayer,
} from './state'

const VIEW_AHEAD = 6
const VIEW_BEHIND = 3

export default function RunnerView({ code, me, playerList, game }) {
  // My own position is local-first, not read back from the synced `game` prop: Firebase writes
  // are fire-and-forget, so if we read our own row/col from the prop, two rapid taps race
  // against the round-trip and the second tap can compute from a stale row, silently dropping
  // a move. Local state can't go stale against itself, and nothing else needs to read it.
  const [myPos, setMyPos] = useState(
    () => game.positions?.[me.uid] ?? { row: 0, col: START_COL, status: 'active', invincibleUntil: 0 }
  )
  const myPosRef = useRef(myPos)
  myPosRef.current = myPos

  const [hitReason, setHitReason] = useState(null)
  const [slowUntil, setSlowUntil] = useState(0)
  const slowUntilRef = useRef(0)

  const [, setTick] = useState(0)
  const gameStateRef = useRef(game)
  gameStateRef.current = game
  const respawningRef = useRef(false)
  const lastMoveAtRef = useRef(0)
  const lastHandledRef = useRef({ squash: 0, fire: 0, slow: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
      checkCollision()
      checkIncomingAttacks()
      checkFireHazard()
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function squash(reason) {
    const pos = myPosRef.current
    respawningRef.current = true
    setHitReason(reason)
    setMyPos((p) => ({ ...p, status: 'respawning' }))
    markRespawning(code, me.uid)
    setTimeout(() => {
      const newRow = Math.max(0, pos.row - RESPAWN_SETBACK_ROWS)
      const newPos = {
        row: newRow,
        col: pos.col,
        status: 'active',
        invincibleUntil: Date.now() + 250,
      }
      setMyPos(newPos)
      respawnPlayer(code, me.uid, newRow, pos.col)
      respawningRef.current = false
    }, RESPAWN_MS)
  }

  function checkCollision() {
    const g = gameStateRef.current
    const pos = myPosRef.current
    if (!pos || pos.status !== 'active' || respawningRef.current) return
    if (pos.row <= 0 || pos.row >= FINISH_ROW) return

    const elapsedSec = Math.max(0, (Date.now() - g.roundStartAt) / 1000)
    const lane = getLane(g.seed, pos.row, FINISH_ROW)
    const cars = carColumnsAt(lane, COURSE_WIDTH, elapsedSec)
    const invincible = Date.now() < (pos.invincibleUntil ?? 0)

    if (!invincible && cars.includes(pos.col)) squash('Squashed by traffic!')
  }

  // Squash and Slow are guaranteed hits on their locked target — they ignore invincibility and
  // always land. Fire is handled separately below since it also affects bystanders.
  function checkIncomingAttacks() {
    const g = gameStateRef.current
    const ability = g.blockerAbility
    if (!ability) return

    const squashEntry = ability.squash
    if (
      squashEntry &&
      squashEntry.targetUid === me.uid &&
      squashEntry.triggeredAt > lastHandledRef.current.squash
    ) {
      lastHandledRef.current.squash = squashEntry.triggeredAt
      const pos = myPosRef.current
      if (pos && pos.status === 'active' && !respawningRef.current) squash(ATTACKS.squash.alert)
    }

    const slowEntry = ability.slow
    if (
      slowEntry &&
      slowEntry.targetUid === me.uid &&
      slowEntry.triggeredAt > lastHandledRef.current.slow
    ) {
      lastHandledRef.current.slow = slowEntry.triggeredAt
      const until = Date.now() + ATTACKS.slow.durationMs
      slowUntilRef.current = until
      setSlowUntil(until)
    }
  }

  // Fire ignites the target's row (captured at the moment it was cast), guaranteeing the
  // original target gets caught, but it stays lit and dangerous to anyone else who's on that
  // row too — including the Blocker's target if they haven't moved away yet.
  function checkFireHazard() {
    const g = gameStateRef.current
    const fire = g.blockerAbility?.fire
    const pos = myPosRef.current
    if (!fire || !pos || pos.status !== 'active' || respawningRef.current) return

    const isTarget = fire.targetUid === me.uid
    const isNewTrigger = isTarget && fire.triggeredAt > lastHandledRef.current.fire
    if (isNewTrigger) lastHandledRef.current.fire = fire.triggeredAt

    const stillBurning = Date.now() - fire.triggeredAt < ATTACKS.fire.durationMs
    if (!stillBurning) return

    if (isNewTrigger) {
      // Guaranteed: the original target always gets caught, invincibility or not.
      squash(ATTACKS.fire.alert)
      return
    }

    // Anyone else (including the target after their guaranteed hit already resolved) only gets
    // caught by actually standing in the fire, same rules as a normal hazard.
    const invincible = Date.now() < (pos.invincibleUntil ?? 0)
    if (!invincible && pos.row === fire.row) squash(ATTACKS.fire.alert)
  }

  function move(dRow, dCol) {
    const now = Date.now()
    const slowed = now < slowUntilRef.current
    const cooldown = slowed ? MOVE_COOLDOWN_MS * ATTACKS.slow.moveCooldownMultiplier : MOVE_COOLDOWN_MS
    if (now - lastMoveAtRef.current < cooldown) return
    const pos = myPosRef.current
    if (!pos || pos.status !== 'active') return
    lastMoveAtRef.current = now
    const newRow = Math.min(FINISH_ROW, Math.max(0, pos.row + dRow))
    const newCol = Math.min(COURSE_WIDTH - 1, Math.max(0, pos.col + dCol))
    const newPos = { ...pos, row: newRow, col: newCol }
    setMyPos(newPos)
    movePlayer(code, me.uid, newRow, newCol)
    if (newRow >= FINISH_ROW) {
      setMyPos((p) => ({ ...p, status: 'finished' }))
      finishPlayer(code, me.uid)
    }
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowUp' || e.key === 'w') move(1, 0)
      else if (e.key === 'ArrowDown' || e.key === 's') move(-1, 0)
      else if (e.key === 'ArrowLeft' || e.key === 'a') move(0, -1)
      else if (e.key === 'ArrowRight' || e.key === 'd') move(0, 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = Date.now()
  const isSlowed = now < slowUntil
  const effectiveCooldown = isSlowed ? MOVE_COOLDOWN_MS * ATTACKS.slow.moveCooldownMultiplier : MOVE_COOLDOWN_MS
  const onCooldown = now - lastMoveAtRef.current < effectiveCooldown

  const elapsedSec = Math.max(0, (now - game.roundStartAt) / 1000)
  const topRow = Math.min(FINISH_ROW, myPos.row + VIEW_AHEAD)
  const bottomRow = Math.max(0, myPos.row - VIEW_BEHIND)
  const rows = []
  for (let r = topRow; r >= bottomRow; r--) rows.push(r)

  const fire = game.blockerAbility?.fire
  const fireActive = fire && now - fire.triggeredAt < ATTACKS.fire.durationMs

  const others = playerList.filter((p) => p.uid !== me.uid && p.uid !== game.blockerUid)

  return (
    <div className="page">
      <div className="brand">
        <h1>Crossy Jump</h1>
        <p>Row {myPos.row} / {FINISH_ROW}</p>
      </div>

      {isSlowed && (
        <div className="card center-text" style={{ borderColor: 'var(--bad)', padding: '0.6rem' }}>
          <p style={{ color: 'var(--bad)', margin: 0 }}>{ATTACKS.slow.alert}</p>
        </div>
      )}

      <div className="card">
        <div className="crossy-course">
          {rows.map((r) => {
            const lane = getLane(game.seed, r, FINISH_ROW)
            const cars = carColumnsAt(lane, COURSE_WIDTH, elapsedSec)
            const isFinish = r >= FINISH_ROW
            const onFire = fireActive && fire.row === r
            return (
              <div
                key={r}
                className={`crossy-row ${lane.type} ${isFinish ? 'finish' : ''} ${onFire ? 'boosted' : ''}`}
              >
                {Array.from({ length: COURSE_WIDTH }, (_, c) => {
                  const isMe = r === myPos.row && c === myPos.col
                  return (
                    <div key={c} className="crossy-tile">
                      {onFire && <span>🔥</span>}
                      {cars.includes(c) && <span>🚗</span>}
                      {isMe && (
                        <span className="crossy-player">{characterEmoji(game.characters?.[me.uid])}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {myPos.status === 'respawning' && (
        <div className="card center-text" style={{ borderColor: 'var(--bad)' }}>
          <p style={{ color: 'var(--bad)' }}>
            {hitReason ?? 'Squashed!'} Respawning...
          </p>
        </div>
      )}

      {myPos.status === 'finished' && (
        <div className="card center-text" style={{ borderColor: 'var(--good)' }}>
          <p style={{ color: 'var(--good)' }}>You made it! Waiting for the round to end...</p>
        </div>
      )}

      {myPos.status === 'active' && (
        <div className="crossy-controls">
          <button disabled={onCooldown} onClick={() => move(1, 0)}>▲</button>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button disabled={onCooldown} onClick={() => move(0, -1)}>◀</button>
            <button disabled={onCooldown} onClick={() => move(-1, 0)}>▼</button>
            <button disabled={onCooldown} onClick={() => move(0, 1)}>▶</button>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="card">
          <h3>Progress</h3>
          <div className="player-list">
            {others.map((p) => {
              const pos = game.positions?.[p.uid]
              return (
                <li key={p.uid}>
                  <span>{characterEmoji(game.characters?.[p.uid])} {p.name}</span>
                  <span className="tag" style={{ marginLeft: 'auto' }}>
                    {pos?.status === 'finished' ? 'Finished!' : `Row ${pos?.row ?? 0}`}
                  </span>
                </li>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

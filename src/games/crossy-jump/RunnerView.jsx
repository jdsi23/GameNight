import { useEffect, useRef, useState } from 'react'
import { characterEmoji } from './characters'
import { carColumnsAt, getLane } from './course'
import {
  BOOST_DURATION_MS,
  BOOST_MULTIPLIER,
  COURSE_WIDTH,
  FINISH_ROW,
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

  const [, setTick] = useState(0)
  const gameStateRef = useRef(game)
  gameStateRef.current = game
  const respawningRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
      checkCollision()
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function checkCollision() {
    const g = gameStateRef.current
    const pos = myPosRef.current
    if (!pos || pos.status !== 'active' || respawningRef.current) return
    if (pos.row <= 0 || pos.row >= FINISH_ROW) return

    const elapsedSec = Math.max(0, (Date.now() - g.roundStartAt) / 1000)
    const lane = getLane(g.seed, pos.row, FINISH_ROW)
    const boostActive =
      g.blockerAbility?.targetRow === pos.row &&
      Date.now() - (g.blockerAbility.triggeredAt ?? 0) < BOOST_DURATION_MS
    const cars = carColumnsAt(lane, COURSE_WIDTH, elapsedSec, boostActive ? BOOST_MULTIPLIER : 1)
    const invincible = Date.now() < (pos.invincibleUntil ?? 0)

    if (!invincible && cars.includes(pos.col)) {
      respawningRef.current = true
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
  }

  function move(dRow, dCol) {
    const pos = myPosRef.current
    if (!pos || pos.status !== 'active') return
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

  const elapsedSec = Math.max(0, (Date.now() - game.roundStartAt) / 1000)
  const topRow = Math.min(FINISH_ROW, myPos.row + VIEW_AHEAD)
  const bottomRow = Math.max(0, myPos.row - VIEW_BEHIND)
  const rows = []
  for (let r = topRow; r >= bottomRow; r--) rows.push(r)

  const others = playerList.filter((p) => p.uid !== me.uid && p.uid !== game.blockerUid)

  return (
    <div className="page">
      <div className="brand">
        <h1>Crossy Jump</h1>
        <p>Row {myPos.row} / {FINISH_ROW}</p>
      </div>

      <div className="card">
        <div className="crossy-course">
          {rows.map((r) => {
            const lane = getLane(game.seed, r, FINISH_ROW)
            const boostActive =
              game.blockerAbility?.targetRow === r &&
              Date.now() - (game.blockerAbility.triggeredAt ?? 0) < BOOST_DURATION_MS
            const cars = carColumnsAt(
              lane,
              COURSE_WIDTH,
              elapsedSec,
              boostActive ? BOOST_MULTIPLIER : 1
            )
            const isFinish = r >= FINISH_ROW
            return (
              <div
                key={r}
                className={`crossy-row ${lane.type} ${isFinish ? 'finish' : ''} ${
                  boostActive ? 'boosted' : ''
                }`}
              >
                {Array.from({ length: COURSE_WIDTH }, (_, c) => {
                  const isMe = r === myPos.row && c === myPos.col
                  return (
                    <div key={c} className="crossy-tile">
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
          <p style={{ color: 'var(--bad)' }}>Squashed! Respawning...</p>
        </div>
      )}

      {myPos.status === 'finished' && (
        <div className="card center-text" style={{ borderColor: 'var(--good)' }}>
          <p style={{ color: 'var(--good)' }}>You made it! Waiting for the round to end...</p>
        </div>
      )}

      {myPos.status === 'active' && (
        <div className="crossy-controls">
          <button onClick={() => move(1, 0)}>▲</button>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button onClick={() => move(0, -1)}>◀</button>
            <button onClick={() => move(-1, 0)}>▼</button>
            <button onClick={() => move(0, 1)}>▶</button>
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

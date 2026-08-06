import { useEffect, useState } from 'react'
import { characterEmoji } from './characters'
import { BOOST_COOLDOWN_MS, FINISH_ROW, triggerBoost } from './state'

export default function BlockerView({ code, playerList, game }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [])

  const runners = playerList.filter((p) => p.uid !== game.blockerUid)
  const furthestRow = Math.max(0, ...runners.map((p) => game.positions?.[p.uid]?.row ?? 0))
  const [targetRow, setTargetRow] = useState(furthestRow + 3)

  const cooldownRemaining = game.blockerAbility
    ? Math.max(0, BOOST_COOLDOWN_MS - (Date.now() - game.blockerAbility.triggeredAt))
    : 0
  const canBoost = cooldownRemaining <= 0

  return (
    <div className="page">
      <div className="brand">
        <h1>Crossy Jump</h1>
        <p>You're The Blocker. Speed up traffic to wreck the runners' timing.</p>
      </div>

      <div className="card">
        <h3>Runner Progress</h3>
        <div className="player-list">
          {runners.map((p) => {
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

      <div className="card center-text">
        <h3>Traffic Boost</h3>
        <p style={{ color: 'var(--text-dim)' }}>
          Pick a row to speed up for a few seconds. Aim just ahead of a runner.
        </p>
        <div className="row" style={{ maxWidth: 280, margin: '0 auto', alignItems: 'center' }}>
          <button
            className="secondary"
            onClick={() => setTargetRow((r) => Math.max(1, r - 1))}
          >
            −
          </button>
          <input
            type="number"
            value={targetRow}
            min={1}
            max={FINISH_ROW - 1}
            onChange={(e) => setTargetRow(Number(e.target.value))}
            style={{ textAlign: 'center' }}
          />
          <button
            className="secondary"
            onClick={() => setTargetRow((r) => Math.min(FINISH_ROW - 1, r + 1))}
          >
            +
          </button>
        </div>
        <button
          style={{ marginTop: '0.9rem' }}
          disabled={!canBoost}
          onClick={() => triggerBoost(code, targetRow)}
        >
          {canBoost ? `Boost Row ${targetRow}` : `Cooling down (${Math.ceil(cooldownRemaining / 1000)}s)`}
        </button>
      </div>
    </div>
  )
}

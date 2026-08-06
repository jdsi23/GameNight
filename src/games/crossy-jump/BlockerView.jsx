import { useEffect, useState } from 'react'
import { ATTACKS, cooldownRemaining } from './attacks'
import { characterEmoji } from './characters'
import { FINISH_ROW, triggerAttack } from './state'

export default function BlockerView({ code, playerList, game }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [])

  const runners = playerList.filter((p) => p.uid !== game.blockerUid)

  return (
    <div className="page">
      <div className="brand">
        <h1>Crossy Jump</h1>
        <p>You're The Blocker. Every attack is locked to a target — it always lands.</p>
      </div>

      <div className="card">
        <h3>Live Positions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {runners.map((p) => {
            const pos = game.positions?.[p.uid]
            const finished = pos?.status === 'finished'
            const pct = Math.min(100, ((pos?.row ?? 0) / FINISH_ROW) * 100)
            return (
              <div key={p.uid}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>{p.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {finished ? 'Finished!' : `Row ${pos?.row ?? 0} / ${FINISH_ROW}`}
                  </span>
                </div>
                <div
                  style={{
                    position: 'relative',
                    height: 10,
                    borderRadius: 999,
                    background: 'var(--bg-panel-raised)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${pct}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: '1.3rem',
                      lineHeight: 1,
                      transition: 'left 0.2s linear',
                    }}
                  >
                    {characterEmoji(game.characters?.[p.uid])}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {Object.values(ATTACKS).map((attack) => {
        const remaining = cooldownRemaining(game.blockerAbility, attack.id)
        const ready = remaining <= 0
        return (
          <div className="card" key={attack.id}>
            <h3>{attack.label}</h3>
            <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>{attack.description}</p>
            <p style={{ color: ready ? 'var(--good)' : 'var(--text-dim)', fontSize: '0.85rem' }}>
              {ready ? 'Ready' : `Cooling down (${Math.ceil(remaining / 1000)}s)`}
            </p>
            <div className="player-list">
              {runners.map((p) => {
                const pos = game.positions?.[p.uid]
                const targetable = ready && pos?.status === 'active'
                return (
                  <li key={p.uid}>
                    <span>{characterEmoji(game.characters?.[p.uid])} {p.name}</span>
                    <span className="tag" style={{ marginLeft: 'auto', marginRight: '0.75rem' }}>
                      {pos?.status === 'finished'
                        ? 'Finished'
                        : pos?.status === 'respawning'
                        ? 'Already down'
                        : `Row ${pos?.row ?? 0}`}
                    </span>
                    <button disabled={!targetable} onClick={() => triggerAttack(code, attack.id, p.uid)}>
                      {attack.label}
                    </button>
                  </li>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

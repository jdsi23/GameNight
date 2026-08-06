import { useEffect } from 'react'
import ReadyButton from '../../components/ReadyButton'
import { getReadyStatus } from '../../lib/majorityReady'
import { CHARACTERS } from './characters'
import { beginCountdown, pickCharacter } from './state'

export default function CharacterSelect({ code, me, playerList, connectedCount, game }) {
  const { majorityReached } = getReadyStatus(game.ready, connectedCount)

  useEffect(() => {
    if (majorityReached) {
      beginCountdown(
        code,
        playerList.map((p) => p.uid)
      )
    }
  }, [code, majorityReached, playerList])

  const characters = game.characters ?? {}
  const myCharacter = characters[me.uid]
  const takenBy = (charId) =>
    Object.entries(characters).find(([uid, c]) => c === charId && uid !== me.uid)

  return (
    <div className="page">
      <div className="brand">
        <h1>Crossy Jump</h1>
        <p>Pick your character. One of you will secretly become The Blocker.</p>
      </div>

      <div className="card">
        <div className="game-grid">
          {CHARACTERS.map((c) => {
            const takenByPlayer = takenBy(c.id)
            const takenName = takenByPlayer
              ? playerList.find((p) => p.uid === takenByPlayer[0])?.name
              : null
            return (
              <button
                key={c.id}
                type="button"
                className={`game-card ${myCharacter === c.id ? 'selected' : ''}`}
                disabled={Boolean(takenByPlayer)}
                onClick={() => pickCharacter(code, me.uid, c.id)}
                style={{ alignItems: 'center', textAlign: 'center' }}
              >
                <div style={{ fontSize: '2.2rem' }}>{c.emoji}</div>
                <h3>{c.label}</h3>
                {takenName && <p style={{ margin: 0 }}>{takenName}</p>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card center-text">
        <ReadyButton
          code={code}
          uid={me.uid}
          readyMap={game.ready}
          connectedCount={connectedCount}
        />
        {!myCharacter && (
          <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>
            Pick a character before you're ready — everyone gets a random default otherwise.
          </p>
        )}
      </div>
    </div>
  )
}

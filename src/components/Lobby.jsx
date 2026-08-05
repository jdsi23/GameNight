import { useNavigate } from 'react-router-dom'
import { GAMES } from '../games/registry'
import { leaveRoom, startGame } from '../lib/room'

export default function Lobby({ code, meta, me, playerList, connectedCount }) {
  const navigate = useNavigate()
  const isHost = meta.hostUid === me.uid
  const canStart = connectedCount >= 1

  async function handleStart(gameId) {
    if (!isHost || !canStart) return
    await startGame(code, gameId)
  }

  async function handleLeave() {
    await leaveRoom(code, me.uid)
    navigate('/')
  }

  return (
    <div className="page">
      <div className="brand">
        <h1>Game Night</h1>
      </div>

      <div className="card center-text">
        <p style={{ color: 'var(--text-dim)', margin: 0 }}>Party code</p>
        <div className="room-code">{code}</div>
      </div>

      <div className="card">
        <h3>Players ({playerList.length})</h3>
        <ul className="player-list">
          {playerList.map((p) => (
            <li key={p.uid}>
              <span className={`dot ${p.connected ? '' : 'offline'}`} />
              <span>{p.name}</span>
              {p.uid === meta.hostUid && <span className="tag">Host</span>}
              {p.uid === me.uid && <span className="tag">You</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>{isHost ? 'Pick a game' : 'Waiting for host to pick a game...'}</h3>
        <div className="game-grid">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              className="game-card"
              disabled={!isHost || !canStart}
              onClick={() => handleStart(g.id)}
            >
              <h3>{g.name}</h3>
              <p>{g.description}</p>
              {isHost && <span className="pill">Start</span>}
            </button>
          ))}
        </div>
      </div>

      <button className="secondary danger" onClick={handleLeave}>
        Leave party
      </button>
    </div>
  )
}

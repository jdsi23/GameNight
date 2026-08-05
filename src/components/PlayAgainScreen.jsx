import { useNavigate } from 'react-router-dom'
import { leaveRoom, replayGame, returnToLobby } from '../lib/room'

export default function PlayAgainScreen({ code, uid, gameId, isHost, title, children }) {
  const navigate = useNavigate()

  async function handlePlayAgain() {
    await replayGame(code, gameId)
  }

  async function handleChooseDifferent() {
    await returnToLobby(code)
  }

  async function handleLeave() {
    await leaveRoom(code, uid)
    navigate('/')
  }

  return (
    <div className="page">
      <div className="card center-text">
        <h2>{title}</h2>
        {children}
      </div>

      <div className="card">
        {isHost ? (
          <div className="row">
            <button onClick={handlePlayAgain}>Play Again</button>
            <button className="secondary" onClick={handleChooseDifferent}>
              Choose Different Game
            </button>
          </div>
        ) : (
          <p className="center-text" style={{ color: 'var(--text-dim)' }}>
            Waiting for the host to start another round...
          </p>
        )}
        <button
          className="secondary danger"
          style={{ marginTop: '0.75rem', width: '100%' }}
          onClick={handleLeave}
        >
          Leave party
        </button>
      </div>
    </div>
  )
}

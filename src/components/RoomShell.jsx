import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useRoom } from '../lib/useRoom'
import { getSavedNickname, saveNickname } from '../lib/auth'
import { joinRoom, setupPresence } from '../lib/room'
import Lobby from './Lobby'
import GameShell from './GameShell'

export default function RoomShell() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { uid, loading: authLoading } = useAuth()
  const { meta, players, playerList, connectedCount, game, loading } = useRoom(code)

  const isMember = Boolean(uid && players[uid])

  useEffect(() => {
    if (!uid || !isMember) return
    const unsubscribe = setupPresence(code, uid)
    return unsubscribe
  }, [code, uid, isMember])

  if (authLoading || loading) {
    return (
      <div className="page page-narrow center-text">
        <p>Loading...</p>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="page page-narrow center-text">
        <h2>Room not found</h2>
        <p style={{ color: 'var(--text-dim)' }}>
          "{code}" doesn't match any active party.
        </p>
        <button onClick={() => navigate('/')}>Back home</button>
      </div>
    )
  }

  if (!isMember) {
    return <JoinInline code={code} uid={uid} />
  }

  const me = { uid, ...players[uid] }

  if (meta.status === 'in-game' && meta.gameId) {
    return (
      <GameShell
        code={code}
        meta={meta}
        me={me}
        playerList={playerList}
        connectedCount={connectedCount}
        game={game}
      />
    )
  }

  return (
    <Lobby
      code={code}
      meta={meta}
      me={me}
      playerList={playerList}
      connectedCount={connectedCount}
    />
  )
}

function JoinInline({ code, uid }) {
  const [nickname, setNickname] = useState(getSavedNickname())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nameValid = nickname.trim().length >= 1 && nickname.trim().length <= 20

  async function handleJoin() {
    if (!nameValid || !uid) return
    setBusy(true)
    setError('')
    try {
      saveNickname(nickname.trim())
      await joinRoom(code, uid, nickname.trim())
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="page page-narrow">
      <div className="brand">
        <h1>Join the party</h1>
        <p>
          Room <strong>{code}</strong> is waiting for you.
        </p>
      </div>
      <div className="card">
        <div className="field">
          <label htmlFor="nickname">Your name</label>
          <input
            id="nickname"
            maxLength={20}
            placeholder="e.g. Sam"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <button
          style={{ marginTop: '0.9rem' }}
          onClick={handleJoin}
          disabled={!nameValid || busy || !uid}
        >
          {busy ? 'Joining...' : 'Join Party'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getSavedNickname, saveNickname } from '../lib/auth'
import { createRoom, joinRoom } from '../lib/room'
import { normalizeRoomCode } from '../lib/roomCode'

export default function Home() {
  const { uid, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(getSavedNickname())
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nameValid = nickname.trim().length >= 1 && nickname.trim().length <= 20

  async function handleCreate() {
    if (!nameValid || !uid) return
    setBusy(true)
    setError('')
    try {
      saveNickname(nickname.trim())
      const code = await createRoom(uid, nickname.trim())
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    const code = normalizeRoomCode(joinCode)
    if (!nameValid || !uid || code.length === 0) return
    setBusy(true)
    setError('')
    try {
      saveNickname(nickname.trim())
      await joinRoom(code, uid, nickname.trim())
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page page-narrow">
      <div className="brand">
        <h1>Game Night</h1>
        <p>Grab a code, gather your crew, cause chaos.</p>
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
      </div>

      <div className="card">
        <h3>Create a party</h3>
        <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
          You'll get a code to share with everyone else.
        </p>
        <button
          onClick={handleCreate}
          disabled={!nameValid || busy || authLoading}
        >
          {busy ? 'Creating...' : 'Create Party'}
        </button>
      </div>

      <div className="card">
        <h3>Join a party</h3>
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <input
            placeholder="CODE"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase', letterSpacing: '0.15em' }}
          />
          <button
            className="secondary"
            onClick={handleJoin}
            disabled={!nameValid || !joinCode || busy || authLoading}
          >
            {busy ? 'Joining...' : 'Join Party'}
          </button>
        </div>
      </div>

      {error && <p className="error-text center-text">{error}</p>}
    </div>
  )
}

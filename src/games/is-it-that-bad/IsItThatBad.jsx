import { useEffect, useState } from 'react'
import ReadyButton from '../../components/ReadyButton'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { getReadyStatus } from '../../lib/majorityReady'
import { CATEGORIES } from './topics'
import {
  beginRound,
  castVote,
  endDiscussion,
  finishVoting,
  setTopicCategory,
  setupLobby,
} from './state'

export default function IsItThatBad({ code, me, hostUid, playerList, connectedCount, game }) {
  const [now, setNow] = useState(Date.now())
  const isHost = hostUid === me.uid

  useEffect(() => {
    if (game) return
    setupLobby(code)
  }, [code, game])

  const { majorityReached: lobbyReady } = getReadyStatus(game?.ready, connectedCount)
  useEffect(() => {
    if (game?.phase === 'lobby' && lobbyReady) {
      beginRound(
        code,
        playerList.map((p) => p.uid)
      )
    }
  }, [code, game?.phase, lobbyReady, playerList])

  useEffect(() => {
    if (game?.phase !== 'discussion') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [game?.phase])

  const { majorityReached } = getReadyStatus(game?.ready, connectedCount)
  const remainingMs = game?.phase === 'discussion' ? Math.max(0, game.timerEndsAt - now) : 0

  useEffect(() => {
    if (game?.phase !== 'discussion') return
    if (majorityReached || remainingMs <= 0) {
      endDiscussion(code)
    }
  }, [code, game?.phase, majorityReached, remainingMs])

  const nonHolderConnected = playerList.filter((p) => p.connected && p.uid !== game?.holderUid)
  const allVoted = game
    ? nonHolderConnected.every((p) => game.votes && game.votes[p.uid] !== undefined)
    : false

  useEffect(() => {
    if (game?.phase !== 'voting') return
    if (nonHolderConnected.length > 0 && allVoted) {
      finishVoting(code)
    }
  }, [code, game?.phase, allVoted, nonHolderConnected.length])

  if (!game) {
    return (
      <div className="card center-text">
        <p>Setting up...</p>
      </div>
    )
  }

  if (game.phase === 'lobby') {
    const categoryLabel =
      CATEGORIES.find((c) => c.id === game.topicCategory)?.label ?? 'Random'
    return (
      <div className="page">
        <div className="brand">
          <h1>Is It Really That Bad?</h1>
        </div>

        <div className="card center-text">
          <h3>Topic Type</h3>
          {isHost ? (
            <select
              value={game.topicCategory ?? 'random'}
              onChange={(e) => setTopicCategory(code, e.target.value)}
              style={{ maxWidth: 280, margin: '0 auto', display: 'block' }}
            >
              <option value="random">Random (any category)</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="pill">{categoryLabel} — picked by host</p>
          )}
        </div>

        <div className="card center-text">
          <ReadyButton code={code} uid={me.uid} readyMap={game.ready} connectedCount={connectedCount} />
        </div>
      </div>
    )
  }

  const holderName = playerList.find((p) => p.uid === game.holderUid)?.name ?? '???'
  const iAmHolder = me.uid === game.holderUid

  if (game.phase === 'reveal') {
    const correctGuessers = nonHolderConnected.filter(
      (p) => game.votes?.[p.uid] === game.alignment
    )
    return (
      <PlayAgainScreen
        code={code}
        uid={me.uid}
        gameId="is-it-that-bad"
        isHost={hostUid === me.uid}
        title="Is it really that bad?"
      >
        <p style={{ fontSize: '1.1rem' }}>"{game.topic}"</p>
        <p>
          The real spin was{' '}
          <strong style={{ color: game.alignment === 'good' ? 'var(--good)' : 'var(--bad)' }}>
            {game.alignment === 'good' ? 'GOOD' : 'EVIL'}
          </strong>
          , according to {holderName}.
        </p>
        <p style={{ color: 'var(--text-dim)' }}>
          {correctGuessers.length > 0
            ? `Nailed it: ${correctGuessers.map((p) => p.name).join(', ')}`
            : 'Nobody guessed right!'}
        </p>
      </PlayAgainScreen>
    )
  }

  const minutes = Math.floor(remainingMs / 60000)
  const seconds = Math.floor((remainingMs % 60000) / 1000)
    .toString()
    .padStart(2, '0')

  return (
    <div className="page">
      <div className="brand">
        <h1>Is It Really That Bad?</h1>
      </div>

      {game.phase === 'discussion' && (
        <>
          <div className="card center-text">
            <p style={{ color: 'var(--text-dim)', margin: 0 }}>Topic</p>
            <p style={{ fontSize: '1.4rem', margin: '0.3rem 0' }}>{game.topic}</p>
            {iAmHolder ? (
              <p>
                Play it{' '}
                <strong style={{ color: game.alignment === 'good' ? 'var(--good)' : 'var(--bad)' }}>
                  {game.alignment === 'good' ? 'GOOD' : 'EVIL'}
                </strong>
                . Answer everyone's scenario questions in a way that hints at it — without ever
                saying the word out loud.
              </p>
            ) : (
              <p>
                Ask {holderName} scenario questions about it — "What's the worst thing to
                bring?", "What would you do first?" — to figure out if they're playing this Good
                or Evil. You have{' '}
                <strong>
                  {minutes}:{seconds}
                </strong>
                .
              </p>
            )}
          </div>
          <div className="card center-text">
            <ReadyButton code={code} uid={me.uid} readyMap={game.ready} connectedCount={connectedCount} />
          </div>
        </>
      )}

      {game.phase === 'voting' && (
        <div className="card center-text">
          {iAmHolder ? (
            <p>Waiting for everyone else to guess...</p>
          ) : game.votes?.[me.uid] ? (
            <p>You guessed <strong>{game.votes[me.uid].toUpperCase()}</strong>. Waiting on the rest...</p>
          ) : (
            <>
              <p>So... was it Good or Evil?</p>
              <div className="row" style={{ maxWidth: 320, margin: '0 auto' }}>
                <button onClick={() => castVote(code, me.uid, 'good')}>Good</button>
                <button className="danger" onClick={() => castVote(code, me.uid, 'evil')}>
                  Evil
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

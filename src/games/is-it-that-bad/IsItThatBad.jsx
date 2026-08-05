import { useEffect, useState } from 'react'
import ReadyButton from '../../components/ReadyButton'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { getReadyStatus } from '../../lib/majorityReady'
import { castVote, endDiscussion, finishVoting, setupRound } from './state'

export default function IsItThatBad({ code, me, hostUid, playerList, connectedCount, game }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (game) return
    setupRound(
      code,
      playerList.map((p) => p.uid)
    )
  }, [code, game, playerList])

  useEffect(() => {
    if (game?.phase !== 'discussion') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [game?.phase])

  const { majorityReached } = getReadyStatus(game?.ready, connectedCount)
  const remainingMs = game ? Math.max(0, game.timerEndsAt - now) : 0

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
        <p>Picking a topic...</p>
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
            {iAmHolder ? (
              <>
                <p style={{ color: 'var(--text-dim)', margin: 0 }}>Your topic</p>
                <p style={{ fontSize: '1.3rem', margin: '0.3rem 0' }}>"{game.topic}"</p>
                <p>
                  Play it{' '}
                  <strong style={{ color: game.alignment === 'good' ? 'var(--good)' : 'var(--bad)' }}>
                    {game.alignment === 'good' ? 'GOOD' : 'EVIL'}
                  </strong>
                  . Don't say the word out loud!
                </p>
              </>
            ) : (
              <p>
                {holderName} has a topic spun Good or Evil. Grill them with questions — you have{' '}
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

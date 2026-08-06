import { useEffect, useState } from 'react'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { checkAllSubmitted, nextRound, setupGame, submitJoke, submitRating } from './state'

export default function HowFunnyAreYou({ code, me, hostUid, playerList, game }) {
  useEffect(() => {
    if (game) return
    setupGame(
      code,
      playerList.map((p) => p.uid)
    )
  }, [code, game, playerList])

  useEffect(() => {
    if (game?.phase !== 'submitting' || !game.submissions) return
    checkAllSubmitted(code)
  }, [code, game?.phase, game?.submissions])

  if (!game) {
    return (
      <div className="card center-text">
        <p>Picking a judge...</p>
      </div>
    )
  }

  const nameFor = (uid) => playerList.find((p) => p.uid === uid)?.name ?? '???'
  const judgeUid = game.playerOrder[game.judgeIndex]
  const iAmJudge = judgeUid === me.uid
  const iAmEliminated = Boolean(game.eliminated?.[me.uid])

  if (game.phase === 'complete') {
    const winnerUid = game.playerOrder.find((u) => !game.eliminated?.[u])
    const ranked = [...playerList].sort((a, b) => (game.scores[b.uid] ?? 0) - (game.scores[a.uid] ?? 0))
    return (
      <PlayAgainScreen
        code={code}
        uid={me.uid}
        gameId="how-funny-are-you"
        isHost={hostUid === me.uid}
        title={`${nameFor(winnerUid)} is the funniest!`}
      >
        <div className="player-list" style={{ textAlign: 'left', marginTop: '1rem' }}>
          {ranked.map((p) => (
            <li key={p.uid}>
              <span>{p.name}</span>
              {p.uid === winnerUid && <span className="tag">Winner</span>}
              {game.eliminated?.[p.uid] && <span className="tag">Eliminated</span>}
              <span className="tag" style={{ marginLeft: 'auto' }}>
                {game.scores[p.uid] ?? 0} pts
              </span>
            </li>
          ))}
        </div>
      </PlayAgainScreen>
    )
  }

  return (
    <div className="page">
      <div className="brand">
        <h1>How Funny Are You?</h1>
        <p>Round {game.round} — {nameFor(judgeUid)} is judging</p>
      </div>

      {game.floorActive && (
        <div className="card center-text" style={{ borderColor: 'var(--bad)' }}>
          <p style={{ color: 'var(--bad)', fontWeight: 700, margin: 0 }}>
            THE FLOOR IS RISING — below {game.floorValue?.toFixed(1)} pts and you're out
          </p>
        </div>
      )}

      <div className="card">
        <h3>Scores</h3>
        <div className="player-list">
          {playerList.map((p) => (
            <li key={p.uid}>
              <span className={`dot ${game.eliminated?.[p.uid] ? 'offline' : ''}`} />
              <span>{p.name}</span>
              {p.uid === judgeUid && <span className="tag">Judging</span>}
              {game.eliminated?.[p.uid] && <span className="tag">Out</span>}
              <span className="tag" style={{ marginLeft: 'auto' }}>
                {game.scores[p.uid] ?? 0} pts
              </span>
            </li>
          ))}
        </div>
      </div>

      {game.phase === 'submitting' && (
        <SubmittingPhase
          code={code}
          me={me}
          iAmJudge={iAmJudge}
          iAmEliminated={iAmEliminated}
          game={game}
        />
      )}

      {game.phase === 'judging' && (
        <JudgingPhase code={code} iAmJudge={iAmJudge} judgeUid={judgeUid} game={game} />
      )}

      {game.phase === 'roundEnd' && (
        <RoundEndPhase code={code} nameFor={nameFor} game={game} />
      )}
    </div>
  )
}

function SubmittingPhase({ code, me, iAmJudge, iAmEliminated, game }) {
  const [draft, setDraft] = useState('')
  // An empty {} written to Realtime Database is dropped entirely and reads back as undefined
  // (e.g. when there's no active non-judge player to submit anything), so game.submissions
  // itself may not exist at all — never index into it without a fallback.
  const mySubmission = game.submissions?.[me.uid]

  if (iAmJudge) {
    return (
      <div className="card center-text">
        <p>You're judging this round — sit tight while everyone writes their joke.</p>
      </div>
    )
  }

  if (iAmEliminated) {
    return (
      <div className="card center-text">
        <p style={{ color: 'var(--text-dim)' }}>You're out, but stick around and watch!</p>
      </div>
    )
  }

  if (!mySubmission) {
    return (
      <div className="card center-text">
        <p>Waiting for the next round...</p>
      </div>
    )
  }

  if (mySubmission.submitted) {
    return (
      <div className="card center-text">
        <p>Joke submitted! Waiting for everyone else...</p>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="pill">{mySubmission.type.replace('-', ' ')}</p>
      <p style={{ fontSize: '1.1rem' }}>{mySubmission.prompt}</p>
      <textarea
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Type your joke..."
        style={{
          width: '100%',
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          color: 'var(--text)',
          padding: '0.65em 0.9em',
          font: 'inherit',
          resize: 'vertical',
        }}
      />
      <button
        style={{ marginTop: '0.75rem' }}
        disabled={!draft.trim()}
        onClick={() => submitJoke(code, me.uid, draft.trim())}
      >
        Submit Joke
      </button>
    </div>
  )
}

function JudgingPhase({ code, iAmJudge, judgeUid, game }) {
  const ratedUid = game.judgingOrder?.[game.judgingIndex]
  const submission = ratedUid ? game.submissions?.[ratedUid] : null

  if (!submission) {
    return (
      <div className="card center-text">
        <p>Tallying it up...</p>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="pill">{submission.type.replace('-', ' ')}</p>
      <p style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>{submission.prompt}</p>
      <p style={{ fontSize: '1.2rem' }}>"{submission.joke}"</p>

      {iAmJudge ? (
        <div>
          <p>Rate it 1-10:</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                style={{ flex: 'none', minWidth: 44 }}
                onClick={() => submitRating(code, judgeUid, ratedUid, n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ color: 'var(--text-dim)' }}>Waiting for the judge to rate this one...</p>
      )}
    </div>
  )
}

function RoundEndPhase({ code, nameFor, game }) {
  return (
    <div className="card">
      <h3>Round {game.round} results</h3>
      <div className="player-list">
        {Object.entries(game.lastRatings ?? {}).map(([uid, rating]) => (
          <li key={uid}>
            <span>{nameFor(uid)}</span>
            <span className="tag" style={{ marginLeft: 'auto' }}>
              +{rating} pts
            </span>
          </li>
        ))}
      </div>
      <button style={{ marginTop: '1rem' }} onClick={() => nextRound(code)}>
        Next Round
      </button>
    </div>
  )
}

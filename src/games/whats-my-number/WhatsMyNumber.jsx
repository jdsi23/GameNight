import { useEffect, useState } from 'react'
import ReadyButton from '../../components/ReadyButton'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { getReadyStatus } from '../../lib/majorityReady'
import { beginGuessing, setupRound, submitGuess } from './state'

export default function WhatsMyNumber({ code, me, hostUid, playerList, connectedCount, game }) {
  const [guess, setGuess] = useState('')

  useEffect(() => {
    if (game) return
    setupRound(
      code,
      playerList.map((p) => p.uid)
    )
  }, [code, game, playerList])

  const { majorityReached } = getReadyStatus(game?.ready, connectedCount)

  useEffect(() => {
    if (game?.phase === 'discuss' && majorityReached) {
      beginGuessing(code)
    }
  }, [code, game?.phase, majorityReached])

  if (!game) {
    return (
      <div className="card center-text">
        <p>Dealing out numbers...</p>
      </div>
    )
  }

  if (game.phase === 'complete') {
    const winners = playerList.filter((p) => game.status[p.uid] === 'won')
    const losers = playerList.filter((p) => game.status[p.uid] === 'lost')
    return (
      <PlayAgainScreen
        code={code}
        uid={me.uid}
        gameId="whats-my-number"
        isHost={hostUid === me.uid}
        title="Round over!"
      >
        <div className="number-reveal" style={{ marginTop: '1rem' }}>
          {playerList.map((p) => (
            <div
              key={p.uid}
              className={`number-card ${game.status[p.uid] === 'won' ? 'won' : ''} ${
                game.status[p.uid] === 'lost' ? 'lost' : ''
              }`}
            >
              <div>{p.name}</div>
              <div className="num">{game.numbers[p.uid]}</div>
              <div className="pill">{game.status[p.uid] === 'won' ? 'Won it!' : 'Out of tries'}</div>
            </div>
          ))}
        </div>
        {winners.length > 0 && (
          <p style={{ color: 'var(--good)' }}>
            Winners: {winners.map((p) => p.name).join(', ')}
          </p>
        )}
        {losers.length > 0 && (
          <p style={{ color: 'var(--text-dim)' }}>
            Better luck next time: {losers.map((p) => p.name).join(', ')}
          </p>
        )}
      </PlayAgainScreen>
    )
  }

  const myStatus = game.status[me.uid]
  const canGuess = game.phase === 'guessing' && myStatus === 'active'

  return (
    <div className="page">
      <div className="brand">
        <h1>What's My Number?</h1>
        {game.phase === 'guessing' && (
          <p>Share with the group what you think your number is before guessing.</p>
        )}
        {game.phase === 'discuss' && (
          <p>Everyone can see your number except you. Talk it out, then hit ready.</p>
        )}
      </div>

      <div className="card">
        <div className="number-reveal">
          {playerList.map((p) => {
            const isMe = p.uid === me.uid
            const status = game.status[p.uid]
            const classes = [
              'number-card',
              status === 'won' ? 'won' : '',
              status === 'lost' ? 'lost' : '',
            ].join(' ')
            return (
              <div key={p.uid} className={classes}>
                <div>{p.name}</div>
                <div className="num">{isMe ? '???' : game.numbers[p.uid]}</div>
                {game.phase === 'guessing' && (
                  <div className="pill">
                    {status === 'won'
                      ? 'Won it!'
                      : status === 'lost'
                      ? 'Out of tries'
                      : `${game.attemptsLeft[p.uid]} tries left`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {game.phase === 'discuss' && (
        <div className="card center-text">
          <ReadyButton code={code} uid={me.uid} readyMap={game.ready} connectedCount={connectedCount} />
        </div>
      )}

      {game.phase === 'guessing' && (
        <div className="card center-text">
          {canGuess ? (
            <div>
              <p>What's your number? Guess whenever you're ready.</p>
              <div className="row" style={{ maxWidth: 320, margin: '0 auto' }}>
                <input
                  type="number"
                  min={-500}
                  max={1000}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="-500 to 1000"
                />
                <button
                  disabled={guess.trim() === ''}
                  onClick={() => {
                    const val = Number(guess)
                    setGuess('')
                    submitGuess(code, me.uid, val)
                  }}
                >
                  Guess
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-dim)' }}>
              {myStatus === 'won' ? "You already won this round!" : "You're out of tries — watch how everyone else does."}
            </p>
          )}
        </div>
      )}

      {game.phase === 'guessing' && game.guesses?.length > 0 && (
        <div className="card">
          <h3>Guesses so far</h3>
          <p style={{ color: 'var(--text-dim)', marginTop: 0, fontSize: '0.85rem' }}>
            Anonymous — everyone's guesses, not tied to who made them.
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            {game.guesses
              .slice()
              .reverse()
              .map((g, i) => (
                <span
                  key={i}
                  className="pill"
                  style={{
                    flex: 'none',
                    borderColor: g.correct ? 'var(--good)' : 'var(--border)',
                    color: g.correct ? 'var(--good)' : 'var(--text-dim)',
                  }}
                >
                  {g.value} {g.correct ? '✓' : '✗'}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

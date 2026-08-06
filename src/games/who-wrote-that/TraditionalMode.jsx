import { useEffect, useState } from 'react'
import ReadyButton from '../../components/ReadyButton'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { getReadyStatus } from '../../lib/majorityReady'
import {
  castAuthorGuess,
  castThumbs,
  checkTraditionalEditingComplete,
  checkVotingComplete,
  computeTraditionalScores,
  forceAdvanceToVoting,
  submitTraditionalSegment,
} from './state'

/** Renders a paragraph's parts, only highlighting segments the player actually edited
 *  (force-advancing past the editing phase can leave some segments at their original text). */
function renderParagraph(paragraph) {
  return paragraph.parts.map((part, i) => {
    if (part.type === 'text') return <span key={i}>{part.value}</span>
    const seg = paragraph.segments[part.id]
    return seg.filled ? (
      <strong key={i} style={{ color: 'var(--good)' }}>
        {seg.current}
      </strong>
    ) : (
      <span key={i}>{seg.original}</span>
    )
  })
}

export default function TraditionalMode({ code, me, hostUid, playerList, connectedCount, game }) {
  const uids = playerList.map((p) => p.uid)

  if (game.phase === 'editing') {
    return (
      <EditingPhase code={code} me={me} connectedCount={connectedCount} game={game} />
    )
  }

  if (game.phase === 'voting') {
    return (
      <VotingPhase code={code} me={me} playerList={playerList} game={game} uids={uids} />
    )
  }

  return (
    <RevealPhase code={code} me={me} hostUid={hostUid} playerList={playerList} game={game} uids={uids} />
  )
}

function EditingPhase({ code, me, connectedCount, game }) {
  useEffect(() => {
    checkTraditionalEditingComplete(code)
  }, [code, game.paragraphs])

  const { majorityReached } = getReadyStatus(game.doneReady, connectedCount)
  useEffect(() => {
    if (majorityReached) forceAdvanceToVoting(code)
  }, [code, majorityReached])

  const myParagraph = game.paragraphs[me.uid]

  return (
    <div className="page">
      <div className="brand">
        <h1>Who Wrote That?</h1>
        <p>This is your paragraph — nobody else can see it yet. Rewrite your highlighted words.</p>
      </div>

      <div className="card">
        <p className="paragraph-block" style={{ textAlign: 'left' }}>
          {myParagraph.parts.map((part, i) => {
            if (part.type === 'text') return <span key={i}>{part.value}</span>
            return (
              <MySegment
                key={part.id}
                code={code}
                uid={me.uid}
                segmentId={part.id}
                segment={myParagraph.segments[part.id]}
              />
            )
          })}
        </p>
      </div>

      <div className="card center-text">
        <p style={{ color: 'var(--text-dim)', margin: 0 }}>
          {Object.values(myParagraph.segments).filter((s) => s.filled).length} /{' '}
          {Object.keys(myParagraph.segments).length} lines rewritten
        </p>
      </div>

      <div className="card center-text">
        <ReadyButton
          code={code}
          uid={me.uid}
          readyMap={game.doneReady}
          connectedCount={connectedCount}
          field="doneReady"
          label="Move On"
        />
        <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Everyone finishing their own paragraph also moves things along automatically.
        </p>
      </div>
    </div>
  )
}

function MySegment({ code, uid, segmentId, segment }) {
  const [draft, setDraft] = useState(segment.current)

  if (segment.filled) {
    return <span className="editable-segment filled">{segment.current}</span>
  }

  return (
    <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            submitTraditionalSegment(code, uid, segmentId, draft.trim())
          }
        }}
        style={{ width: `${Math.max(8, draft.length + 4)}ch`, padding: '0.4em 0.6em' }}
      />
      <button
        disabled={!draft.trim()}
        onClick={() => submitTraditionalSegment(code, uid, segmentId, draft.trim())}
      >
        ✓
      </button>
    </span>
  )
}

function VotingPhase({ code, me, playerList, game, uids }) {
  useEffect(() => {
    checkVotingComplete(code, uids)
    // uids is a fresh array every render (derived from playerList); intentionally omitted so
    // this only re-fires when votes/guesses actually change, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, game.thumbsVotes, game.guesses])

  const others = playerList.filter((p) => p.uid !== me.uid)
  const nameFor = (uid) => playerList.find((p) => p.uid === uid)?.name ?? '???'

  return (
    <div className="page">
      <div className="brand">
        <h1>Who Wrote That?</h1>
        <p>Rate each paragraph and guess who wrote it. Scores stay hidden until everyone's done.</p>
      </div>

      {others.map((owner) => {
        const paragraph = game.paragraphs[owner.uid]
        const myVote = game.thumbsVotes?.[owner.uid]?.[me.uid]
        const myGuess = game.guesses?.[owner.uid]?.[me.uid]
        return (
          <div className="card" key={owner.uid}>
            <p className="paragraph-block" style={{ textAlign: 'left' }}>
              {renderParagraph(paragraph)}
            </p>

            <div className="row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className={myVote === 'up' ? '' : 'secondary'}
                onClick={() => castThumbs(code, owner.uid, me.uid, 'up')}
              >
                👍
              </button>
              <button
                className={myVote === 'down' ? 'danger' : 'secondary'}
                onClick={() => castThumbs(code, owner.uid, me.uid, 'down')}
              >
                👎
              </button>
              <select
                value={myGuess ?? ''}
                onChange={(e) => castAuthorGuess(code, owner.uid, me.uid, e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
              >
                <option value="" disabled>
                  Who wrote this?
                </option>
                {others.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )
      })}

      <p className="center-text" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
        {nameFor(me.uid)}, your own paragraph isn't shown here — you can't vote on yourself.
      </p>
    </div>
  )
}

function RevealPhase({ code, me, hostUid, playerList, game, uids }) {
  const { scores, upCounts } = computeTraditionalScores(
    game.paragraphs,
    game.thumbsVotes,
    game.guesses,
    uids
  )
  const nameFor = (uid) => playerList.find((p) => p.uid === uid)?.name ?? '???'
  const ranked = [...playerList].sort((a, b) => (scores[b.uid] ?? 0) - (scores[a.uid] ?? 0))

  return (
    <PlayAgainScreen
      code={code}
      uid={me.uid}
      gameId="who-wrote-that"
      isHost={hostUid === me.uid}
      title="Results"
    >
      <div className="player-list" style={{ textAlign: 'left' }}>
        {ranked.map((p, i) => (
          <li key={p.uid}>
            <span className="tag">#{i + 1}</span>
            <span>{p.name}</span>
            <span className="tag" style={{ marginLeft: 'auto' }}>
              {scores[p.uid] ?? 0} pts
            </span>
          </li>
        ))}
      </div>

      <div style={{ marginTop: '1.25rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {playerList.map((owner) => {
          const paragraph = game.paragraphs[owner.uid]
          const guesses = game.guesses?.[owner.uid] ?? {}
          const correctGuessers = Object.entries(guesses)
            .filter(([, guessedUid]) => guessedUid === owner.uid)
            .map(([voterUid]) => nameFor(voterUid))
          return (
            <div key={owner.uid}>
              <p style={{ marginBottom: '0.3rem' }}>
                <strong>{owner.name}</strong> wrote — 👍 {upCounts[owner.uid] ?? 0}
              </p>
              <p className="paragraph-block" style={{ margin: 0 }}>
                {renderParagraph(paragraph)}
              </p>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                {correctGuessers.length > 0
                  ? `Correctly guessed by: ${correctGuessers.join(', ')}`
                  : 'Nobody guessed the real author.'}
              </p>
            </div>
          )
        })}
      </div>
    </PlayAgainScreen>
  )
}

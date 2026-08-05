import { useEffect, useState } from 'react'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { TEXTS } from './texts'
import { checkRoundComplete, claimSegment, setupRound, submitSegment } from './state'

export default function WhoWroteThat({ code, me, hostUid, playerList, game }) {
  useEffect(() => {
    if (game) return
    setupRound(
      code,
      playerList.map((p) => p.uid)
    )
  }, [code, game, playerList])

  useEffect(() => {
    if (game?.phase !== 'editing' || !game.segments) return
    checkRoundComplete(code)
  }, [code, game?.phase, game?.segments])

  if (!game) {
    return (
      <div className="card center-text">
        <p>Digging up a paragraph...</p>
      </div>
    )
  }

  const source = TEXTS.find((t) => t.id === game.textId)
  const nameFor = (uid) => playerList.find((p) => p.uid === uid)?.name ?? '???'

  if (game.phase === 'reveal') {
    return (
      <PlayAgainScreen
        code={code}
        uid={me.uid}
        gameId="who-wrote-that"
        isHost={hostUid === me.uid}
        title="The finished masterpiece"
      >
        <p className="paragraph-block" style={{ textAlign: 'left' }}>
          {source.parts.map((part, i) =>
            part.type === 'text' ? (
              <span key={i}>{part.value}</span>
            ) : (
              <strong key={i} style={{ color: 'var(--good)' }}>
                {game.segments[part.id].current}
              </strong>
            )
          )}
        </p>
        <div className="player-list" style={{ marginTop: '1rem', textAlign: 'left' }}>
          {source.parts
            .filter((p) => p.type === 'editable')
            .map((p) => (
              <li key={p.id} style={{ display: 'block' }}>
                <span style={{ color: 'var(--text-dim)' }}>"{p.original}"</span> became{' '}
                <strong>"{game.segments[p.id].current}"</strong>
                {game.segments[p.id].claimedBy && (
                  <span className="tag" style={{ marginLeft: '0.5rem' }}>
                    {nameFor(game.segments[p.id].claimedBy)}
                  </span>
                )}
              </li>
            ))}
        </div>
      </PlayAgainScreen>
    )
  }

  const mySegmentId = Object.entries(game.segments).find(
    ([, s]) => s.claimedBy === me.uid && !s.filled
  )?.[0]

  return (
    <div className="page">
      <div className="brand">
        <h1>Who Wrote That?</h1>
        <p>
          {mySegmentId
            ? 'Click your highlighted word to rewrite it.'
            : 'Click any open (dashed) word before someone else does.'}
        </p>
      </div>

      <div className="card">
        <p className="paragraph-block" style={{ textAlign: 'left' }}>
          {source.parts.map((part, i) => {
            if (part.type === 'text') return <span key={i}>{part.value}</span>
            const seg = game.segments[part.id]
            return (
              <EditableSegment
                key={part.id}
                code={code}
                segmentId={part.id}
                segment={seg}
                isMine={seg.claimedBy === me.uid}
                onClaim={() => claimSegment(code, part.id, me.uid)}
              />
            )
          })}
        </p>
      </div>

      <div className="card center-text">
        <p style={{ color: 'var(--text-dim)', margin: 0 }}>
          {Object.values(game.segments).filter((s) => s.filled).length} / {Object.keys(game.segments).length} lines rewritten
        </p>
      </div>
    </div>
  )
}

function EditableSegment({ code, segmentId, segment, isMine, onClaim }) {
  const [draft, setDraft] = useState(segment.current)

  if (segment.filled) {
    return <span className="editable-segment filled">{segment.current}</span>
  }

  if (isMine) {
    return (
      <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              submitSegment(code, segmentId, draft.trim())
            }
          }}
          style={{ width: `${Math.max(6, draft.length + 2)}ch` }}
        />
        <button
          disabled={!draft.trim()}
          onClick={() => submitSegment(code, segmentId, draft.trim())}
        >
          ✓
        </button>
      </span>
    )
  }

  if (segment.claimedBy) {
    return <span className="editable-segment locked">{segment.original}</span>
  }

  return (
    <button type="button" className="editable-segment" onClick={onClaim}>
      {segment.original}
    </button>
  )
}

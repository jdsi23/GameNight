import { useEffect, useState } from 'react'
import ReadyButton from '../../components/ReadyButton'
import PlayAgainScreen from '../../components/PlayAgainScreen'
import { getReadyStatus } from '../../lib/majorityReady'
import TraditionalMode from './TraditionalMode'
import {
  beginRound,
  checkGroupRoundComplete,
  claimSegment,
  setGroupMode,
  setupLobby,
  submitSegment,
} from './state'

export default function WhoWroteThat({ code, me, hostUid, playerList, connectedCount, game }) {
  const isHost = hostUid === me.uid

  useEffect(() => {
    if (game) return
    setupLobby(code)
  }, [code, game])

  const { majorityReached } = getReadyStatus(game?.ready, connectedCount)

  useEffect(() => {
    if (game?.phase === 'lobby' && majorityReached) {
      beginRound(
        code,
        playerList.map((p) => p.uid)
      )
    }
  }, [code, game?.phase, majorityReached, playerList])

  if (!game) {
    return (
      <div className="card center-text">
        <p>Setting up...</p>
      </div>
    )
  }

  if (game.phase === 'lobby') {
    return (
      <div className="page">
        <div className="brand">
          <h1>Who Wrote That?</h1>
        </div>

        <div className="card center-text">
          <h3>Group Mode</h3>
          <p style={{ color: 'var(--text-dim)' }}>
            {game.groupMode
              ? 'Everyone edits one shared paragraph together, first-come-first-served.'
              : 'Traditional: everyone edits their own paragraph, then you vote and guess who wrote what.'}
          </p>
          {isHost ? (
            <button
              className="secondary"
              onClick={() => setGroupMode(code, !game.groupMode)}
            >
              {game.groupMode ? 'Switch to Traditional' : 'Switch to Group Mode'}
            </button>
          ) : (
            <p className="pill">{game.groupMode ? 'Group Mode' : 'Traditional'} selected by host</p>
          )}
        </div>

        <div className="card center-text">
          <ReadyButton code={code} uid={me.uid} readyMap={game.ready} connectedCount={connectedCount} />
        </div>
      </div>
    )
  }

  if (game.mode === 'traditional') {
    return (
      <TraditionalMode
        code={code}
        me={me}
        hostUid={hostUid}
        playerList={playerList}
        connectedCount={connectedCount}
        game={game}
      />
    )
  }

  return (
    <GroupMode code={code} me={me} hostUid={hostUid} playerList={playerList} game={game} />
  )
}

function GroupMode({ code, me, hostUid, playerList, game }) {
  useEffect(() => {
    if (game.phase !== 'editing' || !game.segments) return
    checkGroupRoundComplete(code)
  }, [code, game.phase, game.segments])

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
          {game.parts.map((part, i) =>
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
          {game.parts
            .filter((p) => p.type === 'editable')
            .map((p) => (
              <li key={p.id} style={{ display: 'block' }}>
                <span style={{ color: 'var(--text-dim)' }}>"{game.segments[p.id].original}"</span>{' '}
                became <strong>"{game.segments[p.id].current}"</strong>
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
          {game.parts.map((part, i) => {
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
          style={{
            width: `${Math.max(8, draft.length + 4)}ch`,
            padding: '0.4em 0.6em',
          }}
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

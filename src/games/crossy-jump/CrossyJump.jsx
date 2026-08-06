import { useEffect, useState } from 'react'
import BlockerView from './BlockerView'
import CharacterSelect from './CharacterSelect'
import ResultsScreen from './ResultsScreen'
import RunnerView from './RunnerView'
import { beginPlaying, endRound, setupLobby } from './state'

export default function CrossyJump({ code, me, hostUid, playerList, connectedCount, game }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (game) return
    setupLobby(code)
  }, [code, game])

  useEffect(() => {
    if (!game || game.phase === 'select') return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
    // Deliberately keyed on phase only — re-subscribing on every game update (many times a
    // second once cars are moving) would be wasteful; phase is all that determines whether
    // this ticking clock needs to be running at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase])

  useEffect(() => {
    if (game?.phase !== 'countdown') return
    if (now >= game.countdownEndsAt) beginPlaying(code)
  }, [code, game?.phase, game?.countdownEndsAt, now])

  const runners = playerList.filter((p) => p.uid !== game?.blockerUid)
  const allFinished =
    game?.phase === 'playing' &&
    runners.length > 0 &&
    runners.every((p) => (game.finishedOrder ?? []).includes(p.uid))

  useEffect(() => {
    if (game?.phase !== 'playing') return
    if (now >= game.timerEndsAt || allFinished) endRound(code)
  }, [code, game?.phase, game?.timerEndsAt, now, allFinished])

  if (!game) {
    return (
      <div className="card center-text">
        <p>Loading the course...</p>
      </div>
    )
  }

  if (game.phase === 'select') {
    return (
      <CharacterSelect
        code={code}
        me={me}
        playerList={playerList}
        connectedCount={connectedCount}
        game={game}
      />
    )
  }

  if (game.phase === 'countdown') {
    const secondsLeft = Math.max(0, Math.ceil((game.countdownEndsAt - now) / 1000))
    return (
      <div className="page page-narrow center-text">
        <div className="brand">
          <h1>Crossy Jump</h1>
        </div>
        <div className="card">
          <p style={{ fontSize: '4rem', margin: 0 }}>{secondsLeft > 0 ? secondsLeft : 'GO!'}</p>
        </div>
      </div>
    )
  }

  if (game.phase === 'results') {
    return (
      <ResultsScreen code={code} me={me} hostUid={hostUid} playerList={playerList} game={game} />
    )
  }

  // phase === 'playing'
  if (me.uid === game.blockerUid) {
    return <BlockerView code={code} playerList={playerList} game={game} />
  }
  return <RunnerView code={code} me={me} playerList={playerList} game={game} />
}

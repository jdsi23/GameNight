import PlayAgainScreen from '../../components/PlayAgainScreen'
import { characterEmoji } from './characters'

export default function ResultsScreen({ code, me, hostUid, playerList, game }) {
  const runners = playerList.filter((p) => p.uid !== game.blockerUid)
  const finishedOrder = game.finishedOrder ?? []
  const finished = finishedOrder
    .map((uid) => runners.find((p) => p.uid === uid))
    .filter(Boolean)
  const unfinished = runners
    .filter((p) => !finishedOrder.includes(p.uid))
    .sort((a, b) => (game.positions?.[b.uid]?.row ?? 0) - (game.positions?.[a.uid]?.row ?? 0))

  const blockerName = playerList.find((p) => p.uid === game.blockerUid)?.name ?? '???'

  return (
    <PlayAgainScreen
      code={code}
      uid={me.uid}
      gameId="crossy-jump"
      isHost={hostUid === me.uid}
      title={finished.length > 0 ? `${finished[0].name} made it first!` : 'Nobody made it this time!'}
    >
      <div className="player-list" style={{ textAlign: 'left', marginTop: '1rem' }}>
        {finished.map((p, i) => (
          <li key={p.uid}>
            <span className="tag">#{i + 1}</span>
            <span>
              {characterEmoji(game.characters?.[p.uid])} {p.name}
            </span>
          </li>
        ))}
        {unfinished.map((p) => (
          <li key={p.uid}>
            <span>
              {characterEmoji(game.characters?.[p.uid])} {p.name}
            </span>
            <span className="tag" style={{ marginLeft: 'auto' }}>
              Row {game.positions?.[p.uid]?.row ?? 0}
            </span>
          </li>
        ))}
      </div>
      <p style={{ color: 'var(--text-dim)', marginTop: '1rem' }}>
        The Blocker was {blockerName}.
      </p>
    </PlayAgainScreen>
  )
}

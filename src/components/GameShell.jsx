import { getGame } from '../games/registry'

export default function GameShell({ code, meta, me, playerList, connectedCount, game }) {
  const gameDef = getGame(meta.gameId)

  if (!gameDef) {
    return (
      <div className="page page-narrow center-text">
        <p>Unknown game "{meta.gameId}".</p>
      </div>
    )
  }

  const GameComponent = gameDef.component

  return (
    <div className="page">
      <GameComponent
        code={code}
        me={me}
        hostUid={meta.hostUid}
        playerList={playerList}
        connectedCount={connectedCount}
        game={game}
      />
    </div>
  )
}

import { getGame } from '../games/registry'
import { returnToLobby } from '../lib/room'

export default function GameShell({ code, meta, me, playerList, connectedCount, game }) {
  const gameDef = getGame(meta.gameId)
  const isHost = meta.hostUid === me.uid

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
      {isHost && (
        <button
          type="button"
          className="secondary"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => returnToLobby(code)}
        >
          ← Change Game
        </button>
      )}
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

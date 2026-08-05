import { getReadyStatus, setPlayerReady } from '../lib/majorityReady'

export default function ReadyButton({ code, uid, readyMap, connectedCount }) {
  const { readyCount, requiredCount, majorityReached } = getReadyStatus(
    readyMap,
    connectedCount
  )
  const iAmReady = Boolean(readyMap?.[uid])

  return (
    <div className="ready-bar">
      <button
        className={iAmReady ? 'secondary' : ''}
        onClick={() => setPlayerReady(code, uid, !iAmReady)}
        disabled={majorityReached}
      >
        {iAmReady ? "I'm Ready ✓" : "I'm Ready"}
      </button>
      <span className="pill">
        {readyCount}/{requiredCount} needed ({connectedCount} in party)
      </span>
    </div>
  )
}

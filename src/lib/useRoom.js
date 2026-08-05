import { useEffect, useState } from 'react'
import { onValue } from 'firebase/database'
import { roomRef } from './room'

/** Subscribes to the entire rooms/{code} tree and returns its live state. */
export function useRoom(code) {
  const [meta, setMeta] = useState(null)
  const [players, setPlayers] = useState({})
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    const unsubscribe = onValue(roomRef(code), (snap) => {
      const val = snap.val()
      setMeta(val?.meta ?? null)
      setPlayers(val?.players ?? {})
      setGame(val?.game ?? null)
      setLoading(false)
    })
    return unsubscribe
  }, [code])

  const playerList = Object.entries(players).map(([uid, p]) => ({ uid, ...p }))
  const connectedCount = playerList.filter((p) => p.connected).length

  return { meta, players, playerList, connectedCount, game, loading }
}

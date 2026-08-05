import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from './firebase'

const NICKNAME_KEY = 'gamenight_nickname'

export function useAuthUser() {
  const [uid, setUid] = useState(auth.currentUser?.uid ?? null)
  const [loading, setLoading] = useState(!auth.currentUser)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid)
        setLoading(false)
      } else {
        signInAnonymously(auth).catch((err) => {
          console.error('Anonymous sign-in failed', err)
          setLoading(false)
        })
      }
    })
    return unsubscribe
  }, [])

  return { uid, loading }
}

export function getSavedNickname() {
  return localStorage.getItem(NICKNAME_KEY) ?? ''
}

export function saveNickname(name) {
  localStorage.setItem(NICKNAME_KEY, name)
}

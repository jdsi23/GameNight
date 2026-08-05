import { createContext, useContext } from 'react'
import { useAuthUser } from './auth'

const AuthContext = createContext({ uid: null, loading: true })

export function AuthProvider({ children }) {
  const auth = useAuthUser()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

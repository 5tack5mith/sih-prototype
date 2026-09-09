import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  clearToken,
  fetchCurrentUser,
  getToken,
  login as requestLogin,
  setUnauthorizedHandler,
} from '../api/client'
import { isAdmin, isInvestigator } from './roles'
import { emptyAuthState, identityFromBackend, restoreSession } from './session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => emptyAuthState(Boolean(getToken())))

  const logout = useCallback(() => {
    clearToken()
    setAuth(emptyAuthState(false))
  }, [])

  const signIn = useCallback(async (username, password) => {
    const data = await requestLogin(username, password)
    const next = identityFromBackend(data)
    if (!next.isAuthenticated) {
      clearToken()
      throw new Error('Login response missing identity')
    }
    setAuth(next)
    return data
  }, [])

  useEffect(() => {
    let cancelled = false
    restoreSession({
      hasToken: () => Boolean(getToken()),
      fetchCurrentUser,
      clearSession: clearToken,
    }).then((next) => {
      if (!cancelled) setAuth(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = useMemo(
    () => ({
      isAuthenticated: auth.isAuthenticated,
      username: auth.username,
      role: auth.role,
      loading: auth.loading,
      user: auth.isAuthenticated ? { username: auth.username, role: auth.role } : null,
      signIn,
      logout,
      isAdmin: isAdmin(auth.role),
      isInvestigator: isInvestigator(auth.role),
    }),
    [auth, logout, signIn],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (value == null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}

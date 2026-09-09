import { normalizeRole } from './roles.js'

export function emptyAuthState(loading = false) {
  return {
    isAuthenticated: false,
    username: null,
    role: null,
    loading,
  }
}

export function identityFromBackend(user) {
  const username = typeof user?.username === 'string' ? user.username.trim() : ''
  const role = normalizeRole(user?.role)
  if (!username || !role) return emptyAuthState(false)
  return {
    isAuthenticated: true,
    username,
    role,
    loading: false,
  }
}

export async function restoreSession({ hasToken, fetchCurrentUser, clearSession }) {
  if (!hasToken()) return emptyAuthState(false)
  const user = await fetchCurrentUser()
  const next = identityFromBackend(user)
  if (!next.isAuthenticated) clearSession?.()
  return next
}

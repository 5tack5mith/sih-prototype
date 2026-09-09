const API_BASE = '/api'
const TOKEN_KEY = 'netra_access_token'
const USER_KEY = 'netra_user'

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

// { username, role } from the /login response — kept alongside the token
// so a page reload (same tab) can restore the header without a /me round trip.
export function getUser() {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setUser(user) {
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  else sessionStorage.removeItem(USER_KEY)
}

// Clears the session and tells App.jsx to drop back to the login screen.
// Every /cases endpoint requires auth, so a 401 from apiFetch always means
// "not logged in anymore" (missing or expired token), never a per-call error.
export function endSession() {
  clearToken()
  setUser(null)
  window.dispatchEvent(new Event('auth:unauthorized'))
}

function errorDetail(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail
  return fallback
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (response.status === 401) endSession()
  return response
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    let detail = `Login failed (HTTP ${response.status})`
    try {
      detail = errorDetail(await response.json(), detail)
    } catch {
      // Keep the HTTP fallback when the body is not JSON.
    }
    throw new Error(detail)
  }

  const data = await response.json()
  setToken(data.access_token)
  const user = { username: data.username, role: data.role }
  setUser(user)
  return user
}

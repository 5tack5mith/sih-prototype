const API_BASE = '/api'
const TOKEN_KEY = 'netra_access_token'

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
  return fetch(`${API_BASE}${path}`, { ...options, headers })
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
  return data
}

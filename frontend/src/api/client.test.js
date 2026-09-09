import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

const store = new Map()
globalThis.sessionStorage = {
  getItem(key) {
    return store.has(key) ? store.get(key) : null
  },
  setItem(key, value) {
    store.set(key, String(value))
  },
  removeItem(key) {
    store.delete(key)
  },
}

const {
  apiFetch,
  clearToken,
  fetchCurrentUser,
  getToken,
  login,
  setToken,
  setUnauthorizedHandler,
} = await import('./client.js')

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  store.clear()
  setUnauthorizedHandler(null)
  globalThis.fetch = async () => jsonResponse(500, {})
})

describe('login response', () => {
  test('TEST 1: stores token and returns admin identity from backend', async () => {
    globalThis.fetch = async () =>
      jsonResponse(200, { access_token: 'admin-jwt', username: 'admin', role: 'admin' })
    const data = await login('admin', 'secret')
    assert.equal(getToken(), 'admin-jwt')
    assert.equal(data.username, 'admin')
    assert.equal(data.role, 'admin')
  })

  test('TEST 2: stores token and returns investigator identity from backend', async () => {
    globalThis.fetch = async () =>
      jsonResponse(200, { access_token: 'inv-jwt', username: 'inv1', role: 'investigator' })
    const data = await login('inv1', 'secret')
    assert.equal(getToken(), 'inv-jwt')
    assert.equal(data.username, 'inv1')
    assert.equal(data.role, 'investigator')
  })

  test('sessionStorage stores only the access token, not a role', async () => {
    globalThis.fetch = async () =>
      jsonResponse(200, { access_token: 'inv-jwt', username: 'inv1', role: 'investigator' })
    await login('inv1', 'secret')
    assert.equal(store.get('netra_access_token'), 'inv-jwt')
    assert.equal(store.has('role'), false)
    assert.equal(store.has('netra_role'), false)
    assert.equal(sessionStorage.getItem('role'), null)
  })
})

describe('api authorization handling', () => {
  test('TEST 6: 401 clears authentication via the unauthorized handler', async () => {
    setToken('expired-jwt')
    let loggedOut = false
    setUnauthorizedHandler(() => {
      clearToken()
      loggedOut = true
    })
    globalThis.fetch = async () => jsonResponse(401, { detail: 'Invalid or expired token' })
    const user = await fetchCurrentUser()
    assert.equal(user, null)
    assert.equal(loggedOut, true)
    assert.equal(getToken(), null)
  })

  test('TEST 7: 403 does not logout', async () => {
    setToken('valid-jwt')
    let loggedOut = false
    setUnauthorizedHandler(() => {
      loggedOut = true
    })
    globalThis.fetch = async () => jsonResponse(403, { detail: 'Admins only' })
    const response = await apiFetch('/cases/CASE-A', { method: 'PATCH', body: '{}' })
    assert.equal(response.status, 403)
    assert.equal(loggedOut, false)
    assert.equal(getToken(), 'valid-jwt')
  })
})

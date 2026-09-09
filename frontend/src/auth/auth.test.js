import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { hasRole, isAdmin, isInvestigator, normalizeRole } from './roles.js'
import { emptyAuthState, identityFromBackend, restoreSession } from './session.js'

describe('role helpers', () => {
  test('accepts only backend roles', () => {
    assert.equal(normalizeRole('admin'), 'admin')
    assert.equal(normalizeRole('investigator'), 'investigator')
    assert.equal(normalizeRole('ADMIN'), null)
    assert.equal(normalizeRole('admin '), null)
    assert.equal(normalizeRole('superuser'), null)
  })

  test('does not treat a frontend-chosen label as admin', () => {
    assert.equal(isAdmin('admin'), true)
    assert.equal(isAdmin('investigator'), false)
    assert.equal(isAdmin('ADMIN'), false)
    assert.equal(isInvestigator('investigator'), true)
    assert.equal(hasRole('admin', 'admin'), true)
    assert.equal(hasRole('investigator', 'admin'), false)
  })
})

describe('identity from backend', () => {
  test('TEST 1: admin login response becomes authenticated admin', () => {
    const next = identityFromBackend({ username: 'admin', role: 'admin' })
    assert.equal(next.isAuthenticated, true)
    assert.equal(next.username, 'admin')
    assert.equal(next.role, 'admin')
    assert.equal(next.loading, false)
  })

  test('TEST 2: investigator login response becomes authenticated investigator', () => {
    const next = identityFromBackend({ username: 'inv1', role: 'investigator' })
    assert.equal(next.isAuthenticated, true)
    assert.equal(next.username, 'inv1')
    assert.equal(next.role, 'investigator')
  })

  test('rejects a client-supplied role that the backend did not return', () => {
    const next = identityFromBackend({ username: 'admin', role: 'superuser' })
    assert.equal(next.isAuthenticated, false)
    assert.equal(next.role, null)
  })
})

describe('session restore and logout', () => {
  test('TEST 3: admin refresh restores identity from /me', async () => {
    const next = await restoreSession({
      hasToken: () => true,
      fetchCurrentUser: async () => ({ username: 'admin', role: 'admin' }),
    })
    assert.equal(next.isAuthenticated, true)
    assert.equal(next.username, 'admin')
    assert.equal(next.role, 'admin')
  })

  test('TEST 4: investigator refresh restores identity from /me', async () => {
    const next = await restoreSession({
      hasToken: () => true,
      fetchCurrentUser: async () => ({ username: 'inv1', role: 'investigator' }),
    })
    assert.equal(next.isAuthenticated, true)
    assert.equal(next.username, 'inv1')
    assert.equal(next.role, 'investigator')
  })

  test('TEST 5: logout clears token user and role', () => {
    const store = { token: 'jwt' }
    const clearSession = () => {
      store.token = null
    }
    clearSession()
    const next = emptyAuthState(false)
    assert.equal(store.token, null)
    assert.equal(next.isAuthenticated, false)
    assert.equal(next.username, null)
    assert.equal(next.role, null)
  })

  test('TEST 6: invalid token /me failure clears session', async () => {
    let cleared = false
    const next = await restoreSession({
      hasToken: () => true,
      fetchCurrentUser: async () => null,
      clearSession: () => {
        cleared = true
      },
    })
    assert.equal(cleared, true)
    assert.equal(next.isAuthenticated, false)
    assert.equal(next.username, null)
    assert.equal(next.role, null)
    assert.equal(next.loading, false)
  })

  test('no token skips /me and shows login', async () => {
    let called = false
    const next = await restoreSession({
      hasToken: () => false,
      fetchCurrentUser: async () => {
        called = true
        return { username: 'admin', role: 'admin' }
      },
    })
    assert.equal(called, false)
    assert.equal(next.isAuthenticated, false)
    assert.equal(next.loading, false)
  })
})

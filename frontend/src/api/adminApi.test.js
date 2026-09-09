import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import { visibleCaseCardActions, visibleCaseListActions } from '../auth/permissions.js'

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
  adminErrorMessage,
  assignInvestigator,
  createUser,
  listUsers,
  loadCaseAccess,
  unassignInvestigator,
} = await import('./adminApi.js')

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  store.clear()
  globalThis.fetch = async () => jsonResponse(500, {})
})

describe('admin user-management and case-access visibility', () => {
  test('admin sees user management and manage case access', () => {
    assert.ok(visibleCaseListActions('admin').includes('manageUsers'))
    assert.ok(visibleCaseCardActions('admin', { remote: true, archived: false }).includes('manageCaseAccess'))
  })

  test('investigator does not see user management or manage case access', () => {
    assert.ok(!visibleCaseListActions('investigator').includes('manageUsers'))
    assert.ok(!visibleCaseCardActions('investigator', { remote: true, archived: false }).includes('manageCaseAccess'))
  })
})

describe('admin APIs', () => {
  test('createUser posts to the existing admin register endpoint', async () => {
    let request
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return jsonResponse(200, { username: 'inv1', role: 'investigator' })
    }
    const created = await createUser({ username: 'inv1', password: 'secret', role: 'investigator' })
    assert.equal(request.url, '/api/register')
    assert.equal(request.options.method, 'POST')
    assert.deepEqual(JSON.parse(request.options.body), {
      username: 'inv1',
      password: 'secret',
      role: 'investigator',
    })
    assert.equal(created.username, 'inv1')
  })

  test('assignment success and revoke success refresh access state', async () => {
    let assigned = []
    globalThis.fetch = async (url, options) => {
      if (url === '/api/users') {
        return jsonResponse(200, [
          { username: 'admin', role: 'admin' },
          { username: 'inv1', role: 'investigator' },
        ])
      }
      if (url === '/api/cases/CASE-A/assignments/inv1' && options?.method === 'PUT') {
        assigned = [{ username: 'inv1' }]
        return jsonResponse(200, assigned)
      }
      if (url === '/api/cases/CASE-A/assignments/inv1' && options?.method === 'DELETE') {
        assigned = []
        return new Response(null, { status: 204 })
      }
      if (url === '/api/cases/CASE-A/assignments') {
        return jsonResponse(200, assigned)
      }
      return jsonResponse(500, {})
    }

    const initial = await loadCaseAccess('CASE-A')
    assert.deepEqual(initial.investigators.map((user) => user.username), ['inv1'])
    assert.deepEqual(initial.assigned, [])

    await assignInvestigator('CASE-A', 'inv1')
    const afterAssign = await loadCaseAccess('CASE-A')
    assert.deepEqual(afterAssign.assigned, ['inv1'])

    await unassignInvestigator('CASE-A', 'inv1')
    const afterRevoke = await loadCaseAccess('CASE-A')
    assert.deepEqual(afterRevoke.assigned, [])
  })

  test('maps 403 and other admin errors', async () => {
    assert.equal(adminErrorMessage(403), 'Only administrators can perform this action.')
    assert.equal(adminErrorMessage(401), 'Session expired. Sign in again.')
    assert.equal(adminErrorMessage(404, 'Investigator not found'), 'Investigator not found')
    assert.equal(adminErrorMessage(409), 'This action conflicts with the current state.')
    assert.equal(adminErrorMessage(422), 'Invalid request.')
    assert.equal(adminErrorMessage(500), 'Unable to complete the request. Try again.')
    globalThis.fetch = async () => jsonResponse(403, { detail: 'Forbidden' })
    await assert.rejects(() => listUsers(), /Only administrators can perform this action/)
  })
})

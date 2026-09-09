import assert from 'node:assert/strict'
import { beforeEach, describe, test } from 'node:test'

import { visibleCaseListActions } from '../auth/permissions.js'

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

const { caseCreatePayload, createCase, createCaseErrorMessage } = await import('./casesApi.js')

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

describe('New Case visibility', () => {
  test('admin sees New Case and investigator does not', () => {
    assert.ok(visibleCaseListActions('admin').includes('createCase'))
    assert.deepEqual(visibleCaseListActions('investigator'), [])
  })
})

describe('create case API', () => {
  test('successful creation posts to /cases without a client case id', async () => {
    let request
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return jsonResponse(201, {
        case_id: 'NX-2026-0910',
        name: 'Operation Silverline',
        status: 'ACTIVE',
        priority: 'II',
        jurisdiction_tag: 'CYBER-INTEL',
        description: 'Empty docket',
        node_count: 0,
        edge_count: 0,
        updated_at: '2026-09-10T00:00:00+00:00',
        lead_analyst: 'admin',
      })
    }
    const created = await createCase({
      name: 'Operation Silverline',
      priority: 'II',
      jurisdiction: 'CYBER-INTEL',
      summary: 'Empty docket',
    })
    const body = JSON.parse(request.options.body)
    assert.equal(request.url, '/api/cases')
    assert.equal(request.options.method, 'POST')
    assert.equal(body.case_name, 'Operation Silverline')
    assert.equal(body.case_id, undefined)
    assert.equal(created.case_id, 'NX-2026-0910')
    assert.equal(created.status, 'ACTIVE')
    assert.equal(created.node_count, 0)
    const nextList = [created, { case_id: 'CASE-A' }]
    assert.equal(nextList[0].case_id, 'NX-2026-0910')
    assert.equal(nextList[1].case_id, 'CASE-A')
  })

  test('failed creation rejects so the modal stays open', async () => {
    globalThis.fetch = async () => jsonResponse(422, { detail: 'Case name is required.' })
    await assert.rejects(
      () => createCase({ name: '', priority: 'II', jurisdiction: 'CYBER-INTEL', summary: null }),
      /Case name is required/,
    )
  })

  test('maps 403, 422, and server errors', () => {
    assert.equal(createCaseErrorMessage(403), 'Only administrators can create cases.')
    assert.equal(createCaseErrorMessage(422, 'Case name is required.'), 'Case name is required.')
    assert.equal(createCaseErrorMessage(500), 'Unable to create case. Try again.')
    assert.equal(caseCreatePayload({ name: 'A', priority: 'I', jurisdiction: 'CYBER-INTEL', summary: '' }).summary, null)
  })
})

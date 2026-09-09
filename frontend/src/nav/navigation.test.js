import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  canAccessPage,
  HOME_PAGE,
  isAdminOnlyPage,
  navSectionsFor,
  resolveAuthorizedPage,
  resolveDestination,
} from './navigation.js'

function sectionIds(role) {
  return navSectionsFor(role).map((section) => section.id)
}

function itemIds(role) {
  return navSectionsFor(role).flatMap((section) => section.items.map((item) => item.id))
}

describe('shared login flow', () => {
  test('admin and investigator both land on cases', () => {
    assert.equal(HOME_PAGE, 'cases')
    assert.equal(resolveAuthorizedPage(HOME_PAGE, 'admin'), 'cases')
    assert.equal(resolveAuthorizedPage(HOME_PAGE, 'investigator'), 'cases')
    assert.equal(resolveDestination('dashboard', 'admin'), 'cases')
    assert.equal(resolveDestination('dashboard', 'investigator'), 'cases')
    assert.equal(resolveDestination('admin-dashboard', 'admin'), 'cases')
  })
})

describe('admin navigation', () => {
  test('admin keeps investigation and case management', () => {
    assert.deepEqual(sectionIds('admin'), ['investigation', 'administration'])
    assert.ok(itemIds('admin').includes('cases'))
    assert.ok(itemIds('admin').includes('network-analysis'))
    assert.ok(itemIds('admin').includes('case-management'))
    assert.ok(!itemIds('admin').includes('user-management'))
  })

  test('admin can access admin-only pages', () => {
    assert.equal(canAccessPage('case-management', 'admin'), true)
    assert.equal(resolveAuthorizedPage('case-management', 'admin'), 'case-management')
    assert.equal(isAdminOnlyPage('case-management'), true)
  })
})

describe('investigator navigation', () => {
  test('investigator has investigation only', () => {
    assert.deepEqual(sectionIds('investigator'), ['investigation'])
    assert.ok(itemIds('investigator').includes('cases'))
    assert.ok(itemIds('investigator').includes('key-players'))
    assert.ok(!itemIds('investigator').includes('case-management'))
    assert.ok(!sectionIds('investigator').includes('administration'))
  })

  test('investigator cannot render admin-only pages', () => {
    assert.equal(canAccessPage('admin-dashboard', 'investigator'), false)
    assert.equal(canAccessPage('case-management', 'investigator'), false)
    assert.equal(resolveAuthorizedPage('admin-dashboard', 'investigator'), 'cases')
    assert.equal(resolveAuthorizedPage('case-management', 'investigator'), 'cases')
  })
})

describe('case workspace tools', () => {
  test('both roles can enter analytical tools after opening a case', () => {
    for (const page of ['overview', 'key-players', 'communities', 'path-explorer', 'structural-criticality']) {
      assert.equal(canAccessPage(page, 'admin'), true)
      assert.equal(canAccessPage(page, 'investigator'), true)
      assert.equal(resolveDestination(page, 'investigator', { hasCase: false }), 'cases')
      assert.equal(resolveDestination(page, 'admin', { hasCase: true }), page)
    }
  })
})

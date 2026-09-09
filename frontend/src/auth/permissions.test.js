import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  ANALYTICAL_TOOLS,
  analyticalToolsFor,
  casePermissions,
  visibleCaseCardActions,
  visibleCaseListActions,
} from './permissions.js'
import { HOME_PAGE } from '../nav/navigation.js'

describe('shared investigation workflow', () => {
  test('home is cases for both roles, not a dashboard', () => {
    assert.equal(HOME_PAGE, 'cases')
  })

  test('analytical tools are identical for admin and investigator', () => {
    assert.deepEqual(analyticalToolsFor('admin'), ANALYTICAL_TOOLS)
    assert.deepEqual(analyticalToolsFor('investigator'), ANALYTICAL_TOOLS)
    assert.deepEqual(ANALYTICAL_TOOLS, [
      'overview',
      'key-players',
      'communities',
      'path-explorer',
      'structural-criticality',
    ])
  })
})

describe('investigator permissions', () => {
  test('can analyze cases and cannot see admin case actions', () => {
    const permissions = casePermissions('investigator')
    assert.equal(permissions.viewCases, true)
    assert.equal(permissions.openCase, true)
    assert.equal(permissions.overview, true)
    assert.equal(permissions.keyPlayers, true)
    assert.equal(permissions.communities, true)
    assert.equal(permissions.pathExplorer, true)
    assert.equal(permissions.structuralCriticality, true)
    assert.equal(permissions.viewGraph, true)
    assert.equal(permissions.searchEntities, true)
    assert.equal(permissions.relationshipEditing, true)
    assert.equal(permissions.exportReports, true)
    assert.equal(permissions.createCase, false)
    assert.equal(permissions.editCaseMetadata, false)
    assert.equal(permissions.deleteCase, false)
    assert.equal(permissions.archiveCase, false)
    assert.equal(permissions.restoreCase, false)
    assert.equal(permissions.manageCaseAccess, false)
    assert.equal(permissions.manageAssignments, false)
    assert.equal(permissions.manageUsers, false)
    assert.deepEqual(visibleCaseListActions('investigator'), [])
    assert.deepEqual(visibleCaseCardActions('investigator', { remote: true, archived: false }), [])
    assert.deepEqual(visibleCaseCardActions('investigator', { remote: true, archived: true }), [])
  })
})

describe('admin permissions', () => {
  test('has investigation plus administrative case actions', () => {
    const permissions = casePermissions('admin')
    assert.equal(permissions.overview, true)
    assert.equal(permissions.createCase, true)
    assert.equal(permissions.editCaseMetadata, true)
    assert.equal(permissions.deleteCase, true)
    assert.equal(permissions.archiveCase, true)
    assert.equal(permissions.restoreCase, true)
    assert.equal(permissions.manageCaseAccess, true)
    assert.equal(permissions.manageAssignments, true)
    assert.equal(permissions.manageUsers, true)
    assert.deepEqual(visibleCaseListActions('admin'), ['manageUsers', 'createCase'])
    assert.deepEqual(visibleCaseCardActions('admin', { remote: true, archived: false }), [
      'editCaseMetadata',
      'manageCaseAccess',
      'archiveCase',
    ])
    assert.deepEqual(visibleCaseCardActions('admin', { remote: true, archived: true }), [
      'editCaseMetadata',
      'restoreCase',
      'deleteCase',
    ])
    assert.deepEqual(visibleCaseCardActions('admin', { remote: false, archived: false }), ['editCaseMetadata'])
  })
})

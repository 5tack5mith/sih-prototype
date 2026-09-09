import { isAdmin } from './roles.js'

export const ANALYTICAL_TOOLS = Object.freeze([
  'overview',
  'key-players',
  'communities',
  'path-explorer',
  'structural-criticality',
])

export function casePermissions(role) {
  const admin = isAdmin(role)
  return {
    viewCases: true,
    openCase: true,
    overview: true,
    keyPlayers: true,
    communities: true,
    pathExplorer: true,
    structuralCriticality: true,
    viewGraph: true,
    searchEntities: true,
    relationshipEditing: true,
    nlpAnalysis: true,
    exportReports: true,
    createCase: admin,
    editCaseMetadata: admin,
    deleteCase: admin,
    archiveCase: admin,
    restoreCase: admin,
    manageCaseAccess: admin,
    manageAssignments: admin,
    manageUsers: admin,
  }
}

export function visibleCaseListActions(role) {
  const permissions = casePermissions(role)
  const actions = []
  if (permissions.manageUsers) actions.push('manageUsers')
  if (permissions.createCase) actions.push('createCase')
  return actions
}

export function visibleCaseCardActions(role, { archived = false, remote = true } = {}) {
  const permissions = casePermissions(role)
  const actions = []
  if (permissions.editCaseMetadata) actions.push('editCaseMetadata')
  if (permissions.manageCaseAccess && remote && !archived) actions.push('manageCaseAccess')
  if (permissions.archiveCase && remote && !archived) actions.push('archiveCase')
  if (permissions.restoreCase && remote && archived) actions.push('restoreCase')
  if (permissions.deleteCase && remote && archived) actions.push('deleteCase')
  return actions
}

export function analyticalToolsFor(_role) {
  return ANALYTICAL_TOOLS
}

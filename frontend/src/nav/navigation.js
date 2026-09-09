import { ROLES } from '../auth/roles.js'

export const HOME_PAGE = 'cases'

export const WORKSPACE_PAGES = Object.freeze([
  'overview',
  'key-players',
  'communities',
  'path-explorer',
  'structural-criticality',
])

export const SHARED_PAGES = Object.freeze([
  HOME_PAGE,
  'dashboard',
  'network-analysis',
  ...WORKSPACE_PAGES,
])

export const ADMIN_ONLY_PAGES = Object.freeze(['admin-dashboard', 'case-management'])

export const NAV_SECTIONS = Object.freeze([
  {
    id: 'investigation',
    label: 'Investigation',
    items: [
      { id: 'cases', label: 'Cases', page: 'cases', hint: 'Open authorized cases' },
      { id: 'network-analysis', label: 'Network Analysis', page: 'network-analysis', hint: 'Case graph and overview' },
      { id: 'key-players', label: 'Key Players', page: 'key-players', hint: 'Centrality ranking' },
      { id: 'communities', label: 'Communities', page: 'communities', hint: 'Cluster structure' },
      { id: 'path-explorer', label: 'Path Explorer', page: 'path-explorer', hint: 'Trace connections' },
      {
        id: 'structural-criticality',
        label: 'Structural Criticality',
        page: 'structural-criticality',
        hint: 'Removal impact',
      },
    ],
    roles: [ROLES.ADMIN, ROLES.INVESTIGATOR],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [{ id: 'case-management', label: 'Case Management', page: 'case-management', hint: 'Create and edit cases' }],
    roles: [ROLES.ADMIN],
  },
])

export function pageRoles(page) {
  if (ADMIN_ONLY_PAGES.includes(page)) return [ROLES.ADMIN]
  if (SHARED_PAGES.includes(page)) return [ROLES.ADMIN, ROLES.INVESTIGATOR]
  return []
}

export function canAccessPage(page, role) {
  return pageRoles(page).includes(role)
}

export function resolveAuthorizedPage(page, role) {
  return canAccessPage(page, role) ? page : HOME_PAGE
}

export function resolveDestination(page, role, { hasCase } = {}) {
  const allowed = resolveAuthorizedPage(page, role)
  if (allowed === 'dashboard' || allowed === 'admin-dashboard') return HOME_PAGE
  if (allowed === 'network-analysis') return hasCase ? 'overview' : HOME_PAGE
  if (WORKSPACE_PAGES.includes(allowed) && !hasCase) return HOME_PAGE
  return allowed
}

export function navSectionsFor(role) {
  return NAV_SECTIONS.filter((section) => section.roles.includes(role)).map((section) => ({
    id: section.id,
    label: section.label,
    items: section.items,
  }))
}

export function isAdminOnlyPage(page) {
  return ADMIN_ONLY_PAGES.includes(page)
}

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  INVESTIGATOR: 'investigator',
})

export function normalizeRole(role) {
  if (role === ROLES.ADMIN || role === ROLES.INVESTIGATOR) return role
  return null
}

export function isAdmin(role) {
  return role === ROLES.ADMIN
}

export function isInvestigator(role) {
  return role === ROLES.INVESTIGATOR
}

export function hasRole(role, expected) {
  return normalizeRole(role) !== null && role === expected
}

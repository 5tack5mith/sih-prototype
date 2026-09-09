import { apiFetch } from './client.js'

export function adminErrorMessage(status, detail) {
  if (status === 401) return 'Session expired. Sign in again.'
  if (status === 403) return 'Only administrators can perform this action.'
  if (status === 404) return typeof detail === 'string' && detail.trim() ? detail : 'Not found.'
  if (status === 409) return typeof detail === 'string' && detail.trim() ? detail : 'This action conflicts with the current state.'
  if (status === 400 || status === 422) {
    return typeof detail === 'string' && detail.trim() ? detail : 'Invalid request.'
  }
  return 'Unable to complete the request. Try again.'
}

async function readError(response) {
  let detail
  try {
    detail = (await response.json())?.detail
  } catch {
    detail = null
  }
  throw new Error(adminErrorMessage(response.status, detail))
}

export async function listUsers() {
  const response = await apiFetch('/users')
  if (!response.ok) await readError(response)
  return response.json()
}

export async function createUser({ username, password, role }) {
  const response = await apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  })
  if (!response.ok) await readError(response)
  return response.json()
}

export async function listAssignments(caseId) {
  const response = await apiFetch(`/cases/${encodeURIComponent(caseId)}/assignments`)
  if (!response.ok) await readError(response)
  return response.json()
}

export async function assignInvestigator(caseId, username) {
  const response = await apiFetch(
    `/cases/${encodeURIComponent(caseId)}/assignments/${encodeURIComponent(username)}`,
    { method: 'PUT' },
  )
  if (!response.ok) await readError(response)
  return response.json()
}

export async function unassignInvestigator(caseId, username) {
  const response = await apiFetch(
    `/cases/${encodeURIComponent(caseId)}/assignments/${encodeURIComponent(username)}`,
    { method: 'DELETE' },
  )
  if (!response.ok) await readError(response)
}

export async function loadCaseAccess(caseId) {
  const [users, assignments] = await Promise.all([listUsers(), listAssignments(caseId)])
  return {
    investigators: users.filter((user) => user.role === 'investigator'),
    assigned: assignments.map((row) => row.username),
  }
}

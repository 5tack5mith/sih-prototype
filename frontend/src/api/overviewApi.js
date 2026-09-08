const API_BASE = '/api'

// GET /cases/{case_id}/overview — app/api/main.py:case_overview
// Returns null when the backend reports 404 ("Case not found").
export async function fetchCaseOverview(caseId) {
  const response = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/overview`)

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Failed to load case overview (HTTP ${response.status})`)
  }

  return response.json()
}

// GET /cases/{case_id}/graph — app/api/main.py:case_graph
// Note: unlike /overview, this endpoint returns 200 with empty nodes/edges
// for a case that doesn't exist — it never 404s.
export async function fetchCaseGraph(caseId) {
  const response = await fetch(`${API_BASE}/cases/${encodeURIComponent(caseId)}/graph`)

  if (!response.ok) {
    throw new Error(`Failed to load case graph (HTTP ${response.status})`)
  }

  return response.json()
}

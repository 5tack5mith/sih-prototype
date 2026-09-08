const API_BASE = '/api'

// GET /cases?filter=&sort= — see app/api/main.py:list_cases
export async function fetchCases({ filter, sort = 'last_activity' } = {}) {
  const params = new URLSearchParams()
  if (filter) params.set('filter', filter)
  if (sort) params.set('sort', sort)
  const query = params.toString()

  const response = await fetch(`${API_BASE}/cases${query ? `?${query}` : ''}`)

  if (!response.ok) {
    throw new Error(`Failed to load cases (HTTP ${response.status})`)
  }

  return response.json()
}

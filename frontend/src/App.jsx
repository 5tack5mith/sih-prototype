import { useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import RequireAdmin from './auth/RequireAdmin'
import Login from './components/Login'
import SessionLoading from './components/SessionLoading'
import Cases from './pages/Cases'
import Overview from './pages/Overview'
import KeyPlayers from './pages/KeyPlayers'
import Communities from './pages/Communities'
import PathExplorer from './pages/PathExplorer'
import StructuralCriticality from './pages/StructuralCriticality'
import { fetchCases, updateCase } from './api/casesApi'
import { HOME_PAGE, resolveDestination } from './nav/navigation'
import './App.css'

const CASE_PAGES = {
  overview: Overview,
  'key-players': KeyPlayers,
  communities: Communities,
  'path-explorer': PathExplorer,
  'structural-criticality': StructuralCriticality,
}

function AppShell() {
  const { isAuthenticated, isAdmin, loading, role } = useAuth()
  const [page, setPage] = useState(HOME_PAGE)
  const [selectedCase, setSelectedCase] = useState(null)
  // All cases, loaded once for the CaseHeader case-ID/name search — shared
  // across every page so switching tabs never re-fetches it. Cases.jsx's
  // own fetch (sort/filter-aware, its own loading state) is separate and
  // intentionally not replaced by this.
  const [cases, setCases] = useState([])
  const [createdCases, setCreatedCases] = useState([])
  const [caseEdits, setCaseEdits] = useState({})
  // Optional payload for the destination page (e.g. a graph-node-click ->
  // Key Players navigation carrying which node to open). A plain
  // onNavigate(key) call (every existing Sidebar click) passes no payload,
  // so it's cleared on any ordinary navigation — only a caller that
  // explicitly passes one keeps it for the page it's navigating to.
  const [navState, setNavState] = useState(null)

  const handleNavigate = (targetPage, payload = null) => {
    setPage(resolveDestination(targetPage, role, { hasCase: Boolean(selectedCase?.id) }))
    setNavState(payload)
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setPage(HOME_PAGE)
      setSelectedCase(null)
      setNavState(null)
      setCreatedCases([])
      return
    }
    setPage((current) => resolveDestination(current, role, { hasCase: Boolean(selectedCase?.id) }))
  }, [isAuthenticated, role])

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    fetchCases()
      .then((result) => {
        if (!cancelled) setCases(result)
      })
      .catch(() => {
        // Search-autocomplete data only; a failed background fetch just
        // means the header search has nothing to suggest yet, not a
        // page-blocking error.
      })
    return () => {
      cancelled = true
    }
  }, [page, isAuthenticated])

  const mergedCases = useMemo(() => {
    const remoteIds = new Set(cases.map((item) => item.case_id))
    const local = isAdmin ? createdCases.filter((item) => !remoteIds.has(item.case_id)) : []
    return [...local, ...cases].map((item) =>
      caseEdits[item.case_id] ? { ...item, ...caseEdits[item.case_id] } : item
    )
  }, [cases, createdCases, caseEdits, isAdmin])

  const handleOpenCase = (caseItem) => {
    const id = caseItem?.id || caseItem?.case_id
    setSelectedCase({ ...caseItem, id })
    setPage('overview')
  }

  const handleUpdateCase = async (draft) => {
    const saved = await updateCase(draft.case_id, {
      name: draft.name,
      priority: draft.priority,
      description: draft.description,
      jurisdiction_tag: draft.jurisdiction_tag,
    })
    const updated = {
      ...draft,
      updated_at: saved?.updated_at || new Date().toISOString(),
      name: saved?.name || draft.name,
      priority: saved?.priority || draft.priority,
      description: saved?.description ?? draft.description,
      jurisdiction_tag: saved?.jurisdiction_tag || draft.jurisdiction_tag,
      lead_analyst: saved?.lead_analyst || draft.lead_analyst,
      status: saved?.status || draft.status,
    }
    const id = updated.case_id
    setCaseEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...updated } }))
    setCases((prev) => prev.map((item) => (item.case_id === id ? { ...item, ...updated } : item)))
    setCreatedCases((prev) => prev.map((item) => (item.case_id === id ? { ...item, ...updated } : item)))
    setSelectedCase((prev) =>
      prev && (prev.id === id || prev.case_id === id)
        ? {
            ...prev,
            id,
            title: updated.name,
            description: updated.description,
            docket: `DOCKET // ${id}${updated.priority ? ` · PRIORITY ${updated.priority}` : ''}`,
          }
        : prev
    )
  }

  if (loading) return <SessionLoading />
  if (!isAuthenticated) return <Login />

  const safePage = resolveDestination(page, role, { hasCase: Boolean(selectedCase?.id) })
  const casesPage = (
    <Cases
      onOpenCase={handleOpenCase}
      onNavigate={handleNavigate}
      createdCases={isAdmin ? createdCases : []}
      caseEdits={caseEdits}
      onCreateCase={(created) => {
        setCases((prev) => [created, ...prev.filter((item) => item.case_id !== created.case_id)])
      }}
      onUpdateCase={handleUpdateCase}
      onCaseStatusChange={(caseId, status) => {
        setCases((prev) => prev.map((item) => (item.case_id === caseId ? { ...item, status } : item)))
        setCaseEdits((prev) => (prev[caseId] ? { ...prev, [caseId]: { ...prev[caseId], status } } : prev))
      }}
      onCaseRemoved={(caseId) => {
        setCases((prev) => prev.filter((item) => item.case_id !== caseId))
        setCreatedCases((prev) => prev.filter((item) => item.case_id !== caseId))
        setCaseEdits((prev) => {
          const next = { ...prev }
          delete next[caseId]
          return next
        })
        setSelectedCase((prev) => (prev && (prev.id === caseId || prev.case_id === caseId) ? null : prev))
      }}
    />
  )

  const CasePage = CASE_PAGES[safePage]
  if (CasePage) {
    return (
      <CasePage
        caseId={selectedCase?.id}
        onBack={() => setPage(HOME_PAGE)}
        onNavigate={handleNavigate}
        cases={mergedCases}
        onSelectCase={(caseItem) => handleOpenCase({ id: caseItem.case_id })}
        navState={navState}
      />
    )
  }

  if (safePage === 'case-management') {
    return <RequireAdmin fallback={casesPage}>{casesPage}</RequireAdmin>
  }

  return casesPage
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App

import { useEffect, useState } from 'react'
import Login from './components/Login'
import Cases from './pages/Cases'
import Overview from './pages/Overview'
import KeyPlayers from './pages/KeyPlayers'
import Communities from './pages/Communities'
import PathExplorer from './pages/PathExplorer'
import StructuralCriticality from './pages/StructuralCriticality'
import { fetchCases } from './api/casesApi'
import './App.css'

const CASE_PAGES = {
  overview: Overview,
  'key-players': KeyPlayers,
  communities: Communities,
  'path-explorer': PathExplorer,
  'structural-criticality': StructuralCriticality,
}

function App() {
  const [page, setPage] = useState('login')
  const [selectedCase, setSelectedCase] = useState(null)
  // All cases, loaded once for the CaseHeader case-ID/name search — shared
  // across every page so switching tabs never re-fetches it. Cases.jsx's
  // own fetch (sort/filter-aware, its own loading state) is separate and
  // intentionally not replaced by this.
  const [cases, setCases] = useState([])

  useEffect(() => {
    if (page === 'login') return

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
  }, [page])

  const handleOpenCase = (caseItem) => {
    setSelectedCase(caseItem)
    setPage('overview')
  }

  const CasePage = CASE_PAGES[page]
  if (CasePage) {
    return (
      <CasePage
        caseId={selectedCase?.id}
        onBack={() => setPage('cases')}
        onNavigate={setPage}
        cases={cases}
        onSelectCase={(caseItem) => handleOpenCase({ id: caseItem.case_id })}
      />
    )
  }

  if (page === 'cases') {
    return <Cases onOpenCase={handleOpenCase} />
  }

  return <Login onLogin={() => setPage('cases')} />
}

export default App

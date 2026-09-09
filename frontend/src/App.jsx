import { useEffect, useState } from 'react'
import Login from './components/Login'
import Cases from './pages/Cases'
import Overview from './pages/Overview'
import KeyPlayers from './pages/KeyPlayers'
import Communities from './pages/Communities'
import PathExplorer from './pages/PathExplorer'
import StructuralCriticality from './pages/StructuralCriticality'
import { fetchCases } from './api/casesApi'
import { getToken, getUser, endSession } from './api/client'
import './App.css'

const CASE_PAGES = {
  overview: Overview,
  'key-players': KeyPlayers,
  communities: Communities,
  'path-explorer': PathExplorer,
  'structural-criticality': StructuralCriticality,
}

function App() {
  // A token already in sessionStorage means this tab logged in earlier —
  // trust it until a request comes back 401 (handled by the
  // auth:unauthorized listener below) rather than re-showing login on
  // every reload within the same tab.
  const [page, setPage] = useState(() => (getToken() ? 'cases' : 'login'))
  const [user, setUser] = useState(() => (getToken() ? getUser() : null))
  const [selectedCase, setSelectedCase] = useState(null)
  // All cases, loaded once for the CaseHeader case-ID/name search — shared
  // across every page so switching tabs never re-fetches it. Cases.jsx's
  // own fetch (sort/filter-aware, its own loading state) is separate and
  // intentionally not replaced by this.
  const [cases, setCases] = useState([])
  // Optional payload for the destination page (e.g. a graph-node-click ->
  // Key Players navigation carrying which node to open). A plain
  // onNavigate(key) call (every existing Sidebar click) passes no payload,
  // so it's cleared on any ordinary navigation — only a caller that
  // explicitly passes one keeps it for the page it's navigating to.
  const [navState, setNavState] = useState(null)

  const handleNavigate = (targetPage, payload = null) => {
    setPage(targetPage)
    setNavState(payload)
  }

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

  // endSession() clears the session and fires 'auth:unauthorized', handled
  // below — used both for an explicit logout click and (from client.js)
  // any 401 response, so session expiry is caught from wherever the user
  // happens to be, not just the logout button.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setCases([])
      setSelectedCase(null)
      setPage('login')
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const CasePage = CASE_PAGES[page]
  if (CasePage) {
    return (
      <CasePage
        caseId={selectedCase?.id}
        onBack={() => setPage('cases')}
        onNavigate={handleNavigate}
        cases={cases}
        onSelectCase={(caseItem) => handleOpenCase({ id: caseItem.case_id })}
        navState={navState}
      />
    )
  }

  if (page === 'cases') {
    return <Cases onOpenCase={handleOpenCase} user={user} onLogout={endSession} />
  }

  return (
    <Login
      onLogin={(loggedInUser) => {
        setUser(loggedInUser)
        setPage('cases')
      }}
    />
  )
}

export default App

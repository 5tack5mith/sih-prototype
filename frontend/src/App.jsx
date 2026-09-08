import { useState } from 'react'
import Login from './components/Login'
import Cases from './pages/Cases'
import Overview from './pages/Overview'
import KeyPlayers from './pages/KeyPlayers'
import Communities from './pages/Communities'
import PathExplorer from './pages/PathExplorer'
import StructuralCriticality from './pages/StructuralCriticality'
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

  const CasePage = CASE_PAGES[page]
  if (CasePage) {
    return <CasePage caseId={selectedCase?.id} onBack={() => setPage('cases')} onNavigate={setPage} />
  }

  if (page === 'cases') {
    return (
      <Cases
        onOpenCase={(caseItem) => {
          setSelectedCase(caseItem)
          setPage('overview')
        }}
      />
    )
  }

  return <Login onLogin={() => setPage('cases')} />
}

export default App

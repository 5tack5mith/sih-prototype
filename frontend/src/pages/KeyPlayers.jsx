import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import PlayersPanel from '../components/keyplayers/PlayersPanel'
import './Overview.css'

function KeyPlayers({ onBack, onNavigate }) {
  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel="NX-2024-0419 // Operation Blackthorn" />
      <div className="overview-page__body">
        <Sidebar active="key-players" onNavigate={onNavigate} />
        <GraphViewport
          title="VIEWPORT: KEY PLAYER CENTRALITY MAP"
          targetLabel="TOP NODE"
          targetValue="VALKYRIE-HOLDINGS LTD"
        />
        <PlayersPanel />
      </div>
    </div>
  )
}

export default KeyPlayers

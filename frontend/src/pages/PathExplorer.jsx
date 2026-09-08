import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import PathExplorerPanel from '../components/pathexplorer/PathExplorerPanel'
import './Overview.css'

function PathExplorer({ onBack, onNavigate }) {
  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel="NX-2024-0419 // Operation Blackthorn" />
      <div className="overview-page__body">
        <Sidebar active="path-explorer" onNavigate={onNavigate} />
        <GraphViewport
          targetLabel="TARGET ENTITY"
          extraTelemetry={[
            { label: 'RESOLUTION', value: '1:1 NATIVE' },
            { label: 'PHYSICS', value: 'FORCE-ATLAS2 (DAMPED)' },
            { label: 'RENDER', value: 'WEBGL HARDWARE' },
          ]}
        />
        <PathExplorerPanel />
      </div>
    </div>
  )
}

export default PathExplorer

import CaseHeader from '../components/overview/CaseHeader'
import CriticalitySidebar from '../components/criticality/CriticalitySidebar'
import GraphViewport from '../components/overview/GraphViewport'
import CriticalityToolbar from '../components/criticality/CriticalityToolbar'
import CriticalityGraph from '../components/criticality/CriticalityGraph'
import CriticalityPanel from '../components/criticality/CriticalityPanel'
import './Overview.css'

function StructuralCriticality({ onBack, onNavigate }) {
  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel="NX-2024-0419 // Operation Blackthorn" />
      <div className="overview-page__body">
        <CriticalitySidebar onNavigate={onNavigate} />
        <GraphViewport
          title="VIEWPORT: STRUCTURAL RESILIENCE ENGINE"
          targetLabel="TARGET ENTITY"
          extraTelemetry={[
            { label: 'RESOLUTION', value: '1:1 NATIVE' },
            { label: 'PHYSICS', value: 'FORCE-ATLAS2 (DAMPED)' },
            { label: 'RENDER', value: 'WEBGL HARDWARE' },
          ]}
          subBar={<CriticalityToolbar />}
          backgroundImage={null}
        >
          <CriticalityGraph />
        </GraphViewport>
        <CriticalityPanel />
      </div>
    </div>
  )
}

export default StructuralCriticality

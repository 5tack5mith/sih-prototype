import { useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import CommunitiesPanel from '../components/communities/CommunitiesPanel'
import CommunityGraphBar from '../components/communities/CommunityGraphBar'
import { CLUSTERS } from '../components/communities/clustersData'
import './Overview.css'

function Communities({ onBack, onNavigate }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = CLUSTERS.find((c) => c.id === selectedId) || null

  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel="NX-2024-0419 // Operation Blackthorn" />
      <div className="overview-page__body">
        <Sidebar active="communities" onNavigate={onNavigate} />
        <GraphViewport
          extraTelemetry={[
            { label: 'RESOLUTION', value: '1:1 NATIVE' },
            { label: 'PHYSICS', value: 'FORCE-ATLAS2 (DAMPED)' },
            { label: 'RENDER', value: 'WEBGL HARDWARE' },
          ]}
          subBar={
            selected ? (
              <CommunityGraphBar cluster={selected} onBack={() => setSelectedId(null)} />
            ) : null
          }
        />
        <CommunitiesPanel
          selectedId={selectedId}
          onSelect={setSelectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    </div>
  )
}

export default Communities

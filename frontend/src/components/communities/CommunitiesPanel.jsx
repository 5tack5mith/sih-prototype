import { CLUSTERS } from './clustersData'
import ClusterListView from './ClusterListView'
import ClusterDetailView from './ClusterDetailView'
import './CommunitiesPanel.css'

function CommunitiesPanel({ selectedId, onSelect, onBack }) {
  const selected = CLUSTERS.find((c) => c.id === selectedId) || null

  return (
    <aside className="cp-panel">
      {selected ? (
        <ClusterDetailView cluster={selected} onBack={onBack} />
      ) : (
        <ClusterListView clusters={CLUSTERS} onSelect={onSelect} />
      )}
    </aside>
  )
}

export default CommunitiesPanel

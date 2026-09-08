import { computeGraphLayout, scoreOf } from './graphLayout'
import './OverviewNetworkGraph.css'

const LABEL_COUNT = 6

function OverviewNetworkGraph({ loadState, errorMessage, graph, onRetry }) {
  if (loadState === 'no-case') {
    return <div className="ovng-state">SELECT A CASE TO VIEW ITS NETWORK GRAPH</div>
  }

  if (loadState === 'loading') {
    return <div className="ovng-state">LOADING NETWORK GRAPH…</div>
  }

  if (loadState === 'not-found') {
    return <div className="ovng-state ovng-state--error">CASE NOT FOUND</div>
  }

  if (loadState === 'error') {
    return (
      <div className="ovng-state ovng-state--error">
        <p className="ovng-state__title">UNABLE TO LOAD NETWORK GRAPH</p>
        <p className="ovng-state__detail">{errorMessage}</p>
        <button type="button" className="ovng-state__retry" onClick={onRetry}>
          RETRY
        </button>
      </div>
    )
  }

  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []

  if (nodes.length === 0) {
    return <div className="ovng-state">NO GRAPH DATA AVAILABLE FOR THIS CASE</div>
  }

  const positioned = computeGraphLayout(nodes)
  const byId = new Map(positioned.map((node) => [String(node.node_id), node]))

  const scores = positioned.map(scoreOf)
  const maxScore = Math.max(...scores, 0.0001)

  const labeled = new Set(
    [...positioned]
      .sort((a, b) => scoreOf(b) - scoreOf(a))
      .slice(0, LABEL_COUNT)
      .map((node) => node.node_id)
  )

  const weights = edges.map((edge) => edge.weight ?? 1)
  const maxWeight = Math.max(...weights, 1)

  return (
    <div className="ovng">
      <svg className="ovng__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map((edge, i) => {
          const source = byId.get(String(edge.source))
          const target = byId.get(String(edge.target))
          if (!source || !target) return null
          const weightRatio = (edge.weight ?? 1) / maxWeight
          return (
            <line
              key={`${edge.source}-${edge.target}-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              className="ovng__edge"
              style={{ strokeWidth: 0.15 + weightRatio * 0.35, opacity: 0.2 + weightRatio * 0.4 }}
            />
          )
        })}
      </svg>

      {positioned.map((node) => {
        const ratio = scoreOf(node) / maxScore
        const size = 5 + ratio * 9
        const isLabeled = labeled.has(node.node_id)

        return isLabeled ? (
          <div
            key={node.node_id}
            className="ovng__entity"
            style={{ left: `${node.x}%`, top: `${node.y}%`, borderColor: `${node.color}99` }}
          >
            <span
              className="ovng__entity-dot"
              style={{ background: node.color, width: size, height: size }}
            />
            <span className="ovng__entity-label">{node.name || node.node_id}</span>
          </div>
        ) : (
          <span
            key={node.node_id}
            className="ovng__dot"
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: size,
              height: size,
              background: node.color,
            }}
          />
        )
      })}
    </div>
  )
}

export default OverviewNetworkGraph

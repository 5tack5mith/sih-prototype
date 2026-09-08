import EntityIcon from './EntityIcon'
import './ClusterDetailView.css'

function ClusterDetailView({ cluster, onBack }) {
  const { color } = cluster

  return (
    <div className="cd">
      <div className="cd__scroll">
        <div className="cd__header">
          <button type="button" className="cd__back" onClick={onBack}>
            <span className="cd__back-arrow">←</span>
            Return to Communities Overview
          </button>
          <div className="cd__modularity" style={{ borderColor: `${color}66`, background: `${color}14` }}>
            <span className="cd__modularity-label" style={{ color }}>
              MODULARITY
            </span>
            <span className="cd__modularity-value">SUBGRAPH {cluster.subgraphIndex}</span>
          </div>
        </div>

        <div className="cd__meta-row">
          <span>PARTITION ID: [{cluster.partitionId}]</span>
          <span>STABILITY INDEX {cluster.stabilityIndex}</span>
        </div>

        <div className="cd__title-row">
          <span className="cd__title-dot" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
          <h2 className="cd__title">{cluster.name}</h2>
        </div>

        <div className="cd__zone-row">
          <span className="cd__zone-tag" style={{ color, borderColor: `${color}66`, background: `${color}1a` }}>
            ⚭ {cluster.zoneTag}
          </span>
          <span className="cd__correlation">CORRELATION: {cluster.correlation}</span>
        </div>

        <div className="cd__stats">
          <div className="cd__stat">
            <span className="cd__stat-value">{cluster.size}</span>
            <span className="cd__stat-label">SIZE</span>
            <span className="cd__stat-sub">Nodes ({cluster.sizePct}% of graph)</span>
          </div>
          <div className="cd__stat">
            <span className="cd__stat-value" style={{ color }}>
              {cluster.internalDensity.toFixed(2)}
            </span>
            <span className="cd__stat-label">INTERNAL DENSITY</span>
            <span className="cd__stat-sub">Intra-cluster density</span>
          </div>
          <div className="cd__stat">
            <span className="cd__stat-value">{cluster.externalDensity.toFixed(2)}</span>
            <span className="cd__stat-label">EXTERNAL DENSITY</span>
            <span className="cd__stat-sub">Inter-cluster bridging</span>
          </div>
        </div>

        <div className="cd__analysis" style={{ borderColor: `${color}40` }}>
          <div className="cd__analysis-title" style={{ color }}>
            <span aria-hidden="true">▤</span> STRUCTURAL PATTERN ANALYSIS
          </div>
          <p className="cd__analysis-text">{cluster.analysis}</p>
        </div>

        <div className="cd__members">
          <div className="cd__members-header">
            <span className="cd__members-title">COMMUNITY MEMBERS [ {cluster.members.length} TOTAL ]</span>
            <span className="cd__members-sort">SORT: CENTRALITY DESC</span>
          </div>

          <div className="cd__members-list">
            {cluster.members.map((member) => (
              <div className="cd-member" key={member.rank}>
                <div className="cd-member__top">
                  <span className="cd-member__name">
                    <span className="cd-member__rank">{String(member.rank).padStart(2, '0')}</span>
                    <EntityIcon type={member.icon} className="cd-member__icon" />
                    <span className="cd-member__name-text">{member.name}</span>
                  </span>
                  <span className="cd-member__right">
                    <span className={`cd-member__tag cd-member__tag--${member.tagVariant}`}>{member.tag}</span>
                    <span className="cd-member__score">{member.score.toFixed(3)}</span>
                  </span>
                </div>
                <div className="cd-member__bar-track">
                  <span
                    className="cd-member__bar-fill"
                    style={{ width: `${member.score * 100}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cd__footer">
        <button type="button" className="cd__btn cd__btn--ghost">
          <span aria-hidden="true">⭳</span> EXPORT CLUSTER DOSSIER
        </button>
        <button type="button" className="cd__btn cd__btn--primary">
          <span aria-hidden="true">▽</span> FILTER GRAPH TO CLUSTER
        </button>
      </div>
    </div>
  )
}

export default ClusterDetailView

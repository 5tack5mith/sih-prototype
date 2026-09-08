import './ClusterListView.css'

function ClusterListView({ clusters, onSelect }) {
  const totalMembers = clusters.reduce((sum, c) => sum + c.size, 0)

  return (
    <div className="cl-list">
      <div className="cl-list__header">
        <div className="cl-list__title-row">
          <h2 className="cl-list__title">Communities</h2>
          <span className="cl-list__tag">{clusters.length} TOTAL</span>
        </div>
        <p className="cl-list__subtitle">
          {totalMembers} entities partitioned across {clusters.length} detected communities
        </p>
      </div>

      <div className="cl-list__scroll">
        {clusters.map((cluster) => (
          <button
            type="button"
            key={cluster.id}
            className="cl-card"
            onClick={() => onSelect(cluster.id)}
          >
            <div className="cl-card__top">
              <span className="cl-card__dot" style={{ background: cluster.color, boxShadow: `0 0 6px ${cluster.color}66` }} />
              <span className="cl-card__name">{cluster.name}</span>
              <span className="cl-card__arrow">→</span>
            </div>
            <div className="cl-card__zone" style={{ color: cluster.color, borderColor: `${cluster.color}66`, background: `${cluster.color}1a` }}>
              {cluster.zoneTag}
            </div>
            <div className="cl-card__stats">
              <div className="cl-card__stat">
                <span className="cl-card__stat-value">{cluster.size}</span>
                <span className="cl-card__stat-label">MEMBERS</span>
              </div>
              <div className="cl-card__stat">
                <span className="cl-card__stat-value" style={{ color: cluster.color }}>
                  {cluster.internalDensity.toFixed(2)}
                </span>
                <span className="cl-card__stat-label">INTERNAL DENSITY</span>
              </div>
              <div className="cl-card__stat">
                <span className="cl-card__stat-value">{cluster.externalDensity.toFixed(2)}</span>
                <span className="cl-card__stat-label">EXTERNAL DENSITY</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="cl-list__footer">
        <span className="cl-list__footer-item">MODULARITY: 0.684</span>
        <span className="cl-list__footer-item">ALGORITHM: K-MEANS</span>
      </div>
    </div>
  )
}

export default ClusterListView

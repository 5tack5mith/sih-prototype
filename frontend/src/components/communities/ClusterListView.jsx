import { communityColor } from '../overview/graphLayout'
import './ClusterListView.css'

function formatDensity(value) {
  if (value === null || value === undefined) return '—'
  return value.toFixed(2)
}

function ClusterListView({ communities, modularity, onSelect }) {
  const totalMembers = communities.reduce((sum, c) => sum + (c.size ?? 0), 0)

  return (
    <div className="cl-list">
      <div className="cl-list__header">
        <div className="cl-list__title-row">
          <h2 className="cl-list__title">Communities</h2>
          <span className="cl-list__tag">{communities.length} TOTAL</span>
        </div>
        <p className="cl-list__subtitle">
          {totalMembers} entities partitioned across {communities.length} detected communities
        </p>
      </div>

      {communities.length === 0 ? (
        <div className="cl-list__scroll">
          <div className="cl-list__empty">NO COMMUNITIES DETECTED FOR THIS CASE</div>
        </div>
      ) : (
        <div className="cl-list__scroll">
          {communities.map((community) => {
            const color = communityColor(community.community_id)
            return (
              <button
                type="button"
                key={community.community_id}
                className="cl-card"
                onClick={() => onSelect(community.community_id)}
              >
                <div className="cl-card__top">
                  <span className="cl-card__dot" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
                  <span className="cl-card__name">{community.label}</span>
                  <span className="cl-card__arrow">→</span>
                </div>
                <div className="cl-card__stats">
                  <div className="cl-card__stat">
                    <span className="cl-card__stat-value">{community.size}</span>
                    <span className="cl-card__stat-label">MEMBERS</span>
                  </div>
                  <div className="cl-card__stat">
                    <span className="cl-card__stat-value" style={{ color }}>
                      {formatDensity(community.internal_density)}
                    </span>
                    <span className="cl-card__stat-label">INTERNAL DENSITY</span>
                  </div>
                  <div className="cl-card__stat">
                    <span className="cl-card__stat-value">{formatDensity(community.external_density)}</span>
                    <span className="cl-card__stat-label">EXTERNAL DENSITY</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="cl-list__footer">
        <span className="cl-list__footer-item">
          MODULARITY: {modularity === null || modularity === undefined ? '—' : modularity.toFixed(3)}
        </span>
        <span className="cl-list__footer-item">ALGORITHM: LOUVAIN</span>
      </div>
    </div>
  )
}

export default ClusterListView

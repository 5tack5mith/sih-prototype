import EntityIcon from './EntityIcon'
import { communityColor } from '../overview/graphLayout'
import './ClusterDetailView.css'

function formatDensity(value) {
  if (value === null || value === undefined) return '—'
  return value.toFixed(2)
}

function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(3)
}

function ClusterDetailView({ communityId, detail, detailLoadState, onBack }) {
  const color = communityColor(communityId)

  if (detailLoadState === 'loading') {
    return (
      <div className="cd">
        <div className="cd__scroll">
          <button type="button" className="cd__back" onClick={onBack}>
            <span className="cd__back-arrow">←</span>
            Return to Communities Overview
          </button>
          <div className="cd__state">LOADING COMMUNITY…</div>
        </div>
      </div>
    )
  }

  if (detailLoadState === 'not-found') {
    return (
      <div className="cd">
        <div className="cd__scroll">
          <button type="button" className="cd__back" onClick={onBack}>
            <span className="cd__back-arrow">←</span>
            Return to Communities Overview
          </button>
          <div className="cd__state cd__state--error">COMMUNITY NOT FOUND</div>
        </div>
      </div>
    )
  }

  if (detailLoadState === 'error' || !detail) {
    return (
      <div className="cd">
        <div className="cd__scroll">
          <button type="button" className="cd__back" onClick={onBack}>
            <span className="cd__back-arrow">←</span>
            Return to Communities Overview
          </button>
          <div className="cd__state cd__state--error">UNABLE TO LOAD COMMUNITY DETAIL</div>
        </div>
      </div>
    )
  }

  const members = [...detail.members].sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0))
  const maxCentrality = Math.max(...members.map((m) => m.centrality ?? 0), 0.0001)

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
              COMMUNITY
            </span>
            <span className="cd__modularity-value">{detail.community_id}</span>
          </div>
        </div>

        <div className="cd__title-row">
          <span className="cd__title-dot" style={{ background: color, boxShadow: `0 0 6px ${color}66` }} />
          <h2 className="cd__title">Cluster {detail.community_id}</h2>
        </div>

        <div className="cd__stats">
          <div className="cd__stat">
            <span className="cd__stat-value">{detail.size}</span>
            <span className="cd__stat-label">SIZE</span>
            <span className="cd__stat-sub">Person nodes</span>
          </div>
          <div className="cd__stat">
            <span className="cd__stat-value" style={{ color }}>
              {formatDensity(detail.internal_density)}
            </span>
            <span className="cd__stat-label">INTERNAL DENSITY</span>
            <span className="cd__stat-sub">Intra-cluster density</span>
          </div>
          <div className="cd__stat">
            <span className="cd__stat-value">{formatDensity(detail.external_density)}</span>
            <span className="cd__stat-label">EXTERNAL DENSITY</span>
            <span className="cd__stat-sub">Inter-cluster bridging</span>
          </div>
        </div>

        <div className="cd__analysis" style={{ borderColor: `${color}40` }}>
          <div className="cd__analysis-title" style={{ color }}>
            <span aria-hidden="true">▤</span> STRUCTURAL PATTERN ANALYSIS
          </div>
          <p className="cd__analysis-text">{detail.narrative}</p>
        </div>

        <div className="cd__members">
          <div className="cd__members-header">
            <span className="cd__members-title">COMMUNITY MEMBERS [ {members.length} TOTAL ]</span>
            <span className="cd__members-sort">SORT: CENTRALITY DESC</span>
          </div>

          {members.length === 0 ? (
            <div className="cd__state">NO MEMBERS RETURNED FOR THIS COMMUNITY</div>
          ) : (
            <div className="cd__members-list">
              {members.map((member, index) => (
                <div className="cd-member" key={member.node_id}>
                  <div className="cd-member__top">
                    <span className="cd-member__name">
                      <span className="cd-member__rank">{String(index + 1).padStart(2, '0')}</span>
                      <EntityIcon type="individual" className="cd-member__icon" />
                      <span className="cd-member__name-text">{member.name || member.node_id}</span>
                    </span>
                    <span className="cd-member__right">
                      <span className="cd-member__tag cd-member__tag--default">
                        {(member.entity_type || 'PERSON').toUpperCase()}
                      </span>
                      <span className="cd-member__score">{formatScore(member.centrality)}</span>
                    </span>
                  </div>
                  <div className="cd-member__bar-track">
                    <span
                      className="cd-member__bar-fill"
                      style={{ width: `${Math.max(2, ((member.centrality ?? 0) / maxCentrality) * 100)}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cd__footer">
        <button type="button" className="cd__btn cd__btn--ghost">
          <span aria-hidden="true">⭳</span> EXPORT CLUSTER DOSSIER
        </button>
      </div>
    </div>
  )
}

export default ClusterDetailView

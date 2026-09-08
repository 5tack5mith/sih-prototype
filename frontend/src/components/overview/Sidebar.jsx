import navOverview from '../../assets/overview/nav-overview.svg'
import navKeyPlayers from '../../assets/overview/nav-key-players.svg'
import navCommunities from '../../assets/overview/nav-communities.svg'
import navPathExplorer from '../../assets/overview/nav-path-explorer.svg'
import navStructuralCriticality from '../../assets/overview/nav-structural-criticality.svg'
import './Sidebar.css'

const NAV_ITEMS = [
  { key: 'overview', icon: navOverview, label: 'Overview', meta: '01' },
  { key: 'key-players', icon: navKeyPlayers, label: 'Key Players', meta: '01' },
  { key: 'communities', icon: navCommunities, label: 'Communities', meta: '3' },
  { key: 'path-explorer', icon: navPathExplorer, label: 'Path Explorer', meta: 'DIR' },
  { key: 'structural-criticality', icon: navStructuralCriticality, label: 'Structural Criticality', meta: 'λ max' },
]

const CLUSTERS = [
  { color: '#38bdf8', label: 'Cluster α: Offshore FinTech' },
  { color: '#c084fc', label: 'Cluster β: Layered Shell Entities' },
  { color: '#fbbf24', label: 'Cluster γ: Escrow & Settlement' },
]

const NAVIGABLE_KEYS = new Set([
  'overview',
  'key-players',
  'communities',
  'path-explorer',
  'structural-criticality',
])

function Sidebar({ active = 'overview', onNavigate }) {
  return (
    <aside className="ov-sidebar">
      <div className="ov-sidebar__header">
        <div className="ov-sidebar__title">
          <span className="ov-sidebar__title-dot" />
          ANALYTICAL TOOLS
        </div>
        <span className="ov-sidebar__version">V2.4</span>
      </div>

      <nav className="ov-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active
          return (
            <button
              type="button"
              key={item.key}
              className={`ov-sidebar__nav-item${isActive ? ' ov-sidebar__nav-item--active' : ''}`}
              onClick={NAVIGABLE_KEYS.has(item.key) ? () => onNavigate?.(item.key) : undefined}
              disabled={!NAVIGABLE_KEYS.has(item.key)}
            >
              <span className="ov-sidebar__nav-left">
                <img src={item.icon} alt="" />
                <span className="ov-sidebar__nav-label">{item.label}</span>
              </span>
              <span className={`ov-sidebar__nav-meta${isActive ? ' ov-sidebar__nav-meta--active' : ''}`}>
                {isActive ? 'ACT' : item.meta}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="ov-sidebar__section">
        <div className="ov-sidebar__section-title">SUBSET FILTERS</div>
        <div className="ov-sidebar__filter-row">
          <span>Show isolates (0)</span>
          <span className="ov-toggle" />
        </div>
        <div className="ov-sidebar__filter-row">
          <span>Bridging ties only</span>
          <span className="ov-toggle ov-toggle--on-teal">
            <span className="ov-toggle__knob" />
          </span>
        </div>
        <div className="ov-sidebar__filter-row ov-sidebar__filter-row--stacked">
          <span className="ov-sidebar__filter-text">
            <span>Cutoff (&gt;0.75 σ)</span>
            <span className="ov-sidebar__filter-subtext">STRICT BETW. THRESHOLD</span>
          </span>
          <span className="ov-toggle ov-toggle--on-gold">
            <span className="ov-toggle__knob" />
          </span>
        </div>
      </div>

      <div className="ov-sidebar__section">
        <div className="ov-sidebar__section-title-row">
          <span className="ov-sidebar__section-title">TOPOLOGY METRICS HUD</span>
          <span className="ov-sidebar__synced">SYNCED</span>
        </div>
        <div className="ov-metrics-grid">
          <div className="ov-metric-card">
            <span className="ov-metric-card__label">DENSITY</span>
            <span className="ov-metric-card__value">0.1742</span>
          </div>
          <div className="ov-metric-card">
            <span className="ov-metric-card__label">DIAMETER</span>
            <span className="ov-metric-card__value">6 HOPS</span>
          </div>
          <div className="ov-metric-card">
            <span className="ov-metric-card__label">RECIPROCITY</span>
            <span className="ov-metric-card__value">41.8%</span>
          </div>
        </div>
      </div>

      <div className="ov-sidebar__section">
        <div className="ov-sidebar__section-title-row">
          <span className="ov-sidebar__section-title">TAXONOMY // METRICS</span>
          <span className="ov-sidebar__synced ov-sidebar__synced--muted">K-MEANS</span>
        </div>
        <div className="ov-cluster-list">
          {CLUSTERS.map((cluster) => (
            <div className="ov-cluster-item" key={cluster.label}>
              <span className="ov-cluster-dot" style={{ background: cluster.color, boxShadow: `0 0 6px ${cluster.color}80` }} />
              <span>{cluster.label}</span>
            </div>
          ))}
        </div>

        <div className="ov-sidebar__legend">
          <div className="ov-sidebar__legend-row">
            <span>Node Size ∝ Betweenness σst(v)</span>
            <span className="ov-sidebar__legend-dots">
              <span className="ov-dot ov-dot--sm" />
              <span className="ov-dot ov-dot--md" />
              <span className="ov-dot ov-dot--ring" />
            </span>
          </div>
          <div className="ov-sidebar__legend-row">
            <span>Edge Thickness = Tx Volume</span>
            <span className="ov-sidebar__legend-line" />
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

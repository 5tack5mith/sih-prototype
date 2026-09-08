import navOverview from '../../assets/overview/nav-overview.svg'
import navKeyPlayers from '../../assets/overview/nav-key-players.svg'
import navCommunities from '../../assets/overview/nav-communities.svg'
import navPathExplorer from '../../assets/overview/nav-path-explorer.svg'
import navStructuralCriticality from '../../assets/overview/nav-structural-criticality.svg'
import './CriticalitySidebar.css'

const NAV_ITEMS = [
  { key: 'overview', icon: navOverview, label: 'Overview' },
  { key: 'key-players', icon: navKeyPlayers, label: 'Key Players' },
  { key: 'communities', icon: navCommunities, label: 'Communities' },
  { key: 'path-explorer', icon: navPathExplorer, label: 'Path Explorer' },
  { key: 'structural-criticality', icon: navStructuralCriticality, label: 'Structural Criticality', active: true },
]

const CLUSTERS = [
  { color: '#38bdf8', label: 'Cluster α: Offshore FinTech' },
  { color: '#c084fc', label: 'Cluster β: Layered Shell Entities' },
  { color: '#fbbf24', label: 'Cluster γ: Escrow & Settlement' },
]

function CriticalitySidebar({ onNavigate }) {
  return (
    <aside className="cs-sidebar">
      <div className="cs-sidebar__header">
        <span className="cs-sidebar__title">
          <span className="cs-sidebar__title-dot" />
          ANALYTICAL TOOLS
        </span>
        <span className="cs-sidebar__version">v2.4</span>
      </div>

      <nav className="cs-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`cs-sidebar__nav-item${item.active ? ' cs-sidebar__nav-item--active' : ''}`}
            onClick={item.active ? undefined : () => onNavigate?.(item.key)}
          >
            <img src={item.icon} alt="" />
            <span className="cs-sidebar__nav-label">{item.label}</span>
            {item.active && <span className="cs-sidebar__nav-tag">ACT</span>}
          </button>
        ))}
      </nav>

      <div className="cs-sidebar__section">
        <div className="cs-sidebar__section-row">
          <span className="cs-sidebar__section-title">SUBSET FILTERS</span>
          <span className="cs-sidebar__applied-tag">3 APPLIED</span>
        </div>

        <div className="cs-filter-row">
          <span>Show isolates (0)</span>
          <span className="cs-toggle" />
        </div>
        <div className="cs-filter-row">
          <span>Bridging ties only</span>
          <span className="cs-toggle cs-toggle--on" />
        </div>
        <div className="cs-filter-row cs-filter-row--value">
          <span>Cutoff (&gt;0.75 σ)</span>
          <span className="cs-filter-value">0.75</span>
        </div>
        <div className="cs-cutoff-track">
          <span className="cs-cutoff-fill" style={{ width: '75%' }} />
        </div>
      </div>

      <div className="cs-sidebar__section">
        <div className="cs-sidebar__section-row">
          <span className="cs-sidebar__section-title">NETWORK METRICS</span>
          <span className="cs-sidebar__calculated-tag">CALCULATED</span>
        </div>

        <div className="cs-metric-row">
          <span className="cs-metric-row__label">DENSITY INDEX</span>
          <span className="cs-metric-row__value">0.1742</span>
        </div>
        <div className="cs-metric-row">
          <span className="cs-metric-row__label">DIAMETER</span>
          <span className="cs-metric-row__value">6 HOPS</span>
        </div>
        <div className="cs-metric-row">
          <span className="cs-metric-row__label">RECIPROCITY</span>
          <span className="cs-metric-row__value">41.8%</span>
        </div>
      </div>

      <div className="cs-sidebar__section cs-sidebar__section--grow">
        <div className="cs-sidebar__section-row">
          <span className="cs-sidebar__section-title">
            TAXONOMY // METRICS <span className="cs-sidebar__info">ⓘ</span>
          </span>
          <span className="cs-sidebar__net-tag">NET-22</span>
        </div>

        <div className="cs-cluster-list">
          {CLUSTERS.map((cluster) => (
            <div className="cs-cluster-item" key={cluster.label}>
              <span
                className="cs-cluster-dot"
                style={{ background: cluster.color, boxShadow: `0 0 6px ${cluster.color}66` }}
              />
              <span>{cluster.label}</span>
            </div>
          ))}
        </div>

        <div className="cs-sidebar__legend">
          <div className="cs-sidebar__legend-row">
            <span>Node: Centrality σst(v)</span>
          </div>
          <div className="cs-sidebar__legend-row">
            <span>Edge: Tx Volume</span>
            <span className="cs-sidebar__legend-value">Hairline</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default CriticalitySidebar

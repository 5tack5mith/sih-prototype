import graphNetwork from '../../assets/overview/graph-network.png'
import fitScreenIcon from '../../assets/overview/fit-screen.svg'
import './GraphViewport.css'

function GraphViewport({
  title = 'VIEWPORT: CRITICAL-PATH GRAPH ENGINE',
  docket = 'NX-2024-0419',
  targetLabel = 'TARGET HUB',
  targetValue = 'VALKYRIE-HOLDINGS LTD',
  extraTelemetry = [],
  subBar = null,
  backgroundImage = graphNetwork,
  children = null,
}) {
  return (
    <section className="ov-graph">
      <div className="ov-graph__topbar">
        <span className="ov-graph__topbar-dot" />
        <span className="ov-graph__topbar-title">{title}</span>
        <span className="ov-graph__topbar-sep">|</span>
        <span className="ov-graph__topbar-item">DOCKET: {docket}</span>
        <span className="ov-graph__topbar-sep">|</span>
        <span className="ov-graph__topbar-item">
          {targetLabel}: <span className="ov-graph__topbar-accent">{targetValue}</span>
        </span>
        {extraTelemetry.map((item) => (
          <span key={item.label} className="ov-graph__topbar-item-group">
            <span className="ov-graph__topbar-sep">|</span>
            <span className="ov-graph__topbar-item">
              {item.label}: <span className="ov-graph__topbar-accent">{item.value}</span>
            </span>
          </span>
        ))}
        <span className="ov-graph__topbar-sep">|</span>
      </div>

      {subBar}

      <div
        className="ov-graph__canvas"
        style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
      >
        {children}
        <div className="ov-graph__watermark">MATRIX KERNEL v4.1.0-FIPS // ENGINE OK</div>

        <div className="ov-graph__controls">
          <button type="button">+</button>
          <button type="button">−</button>
          <button type="button" className="ov-graph__controls-icon">
            <img src={fitScreenIcon} alt="Fit to screen" />
          </button>
          <button type="button">||</button>
        </div>

        <div className="ov-graph__minimap">
          <div className="ov-graph__minimap-header">
            <span>RADAR MINIMAP</span>
            <span className="ov-graph__minimap-loc">LOC: 0.0, 0.0</span>
          </div>
          <div className="ov-graph__minimap-canvas">
            <div className="ov-graph__minimap-viewport">
              <span className="ov-graph__minimap-center" />
            </div>
            <span className="ov-graph__minimap-cluster ov-graph__minimap-cluster--blue" />
            <span className="ov-graph__minimap-cluster ov-graph__minimap-cluster--purple" />
            <span className="ov-graph__minimap-cluster ov-graph__minimap-cluster--amber" />
          </div>
          <div className="ov-graph__minimap-footer">
            <span>SCALE: 0.25x</span>
            <span>FOI: ALL COMMUNITIES</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default GraphViewport

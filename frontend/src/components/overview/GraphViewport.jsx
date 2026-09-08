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
  onZoomIn,
  onZoomOut,
  onFit,
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
          <button type="button" onClick={onZoomIn} disabled={!onZoomIn}>
            +
          </button>
          <button type="button" onClick={onZoomOut} disabled={!onZoomOut}>
            −
          </button>
          <button
            type="button"
            className="ov-graph__controls-icon"
            onClick={onFit}
            disabled={!onFit}
            title="Fit to screen"
          >
            <img src={fitScreenIcon} alt="Fit to screen" />
          </button>
        </div>
      </div>
    </section>
  )
}

export default GraphViewport

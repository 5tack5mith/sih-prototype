import './CriticalityGraph.css'

const CUTPOINT = { x: 48, y: 56 }

const NODES = [
  { id: 'victor', x: 40, y: 20, color: '#38bdf8', label: 'Victor Chen (Nominee)', boxed: false },
  { id: 'almiraj', x: 25, y: 46, color: '#38bdf8', label: 'Al-Miraj Forex Gateway', boxed: true },
  { id: 'boreas', x: 70, y: 40, color: '#c084fc', label: 'Boreas Logistics BV', boxed: true },
  { id: 'kestrel', x: 58, y: 75, color: '#fbbf24', label: 'Kestrel Escrow AG', boxed: true },
  { id: 'apex', x: 46, y: 90, color: '#fbbf24', label: 'Apex Settlement Pool 4', boxed: false },
]

const SATELLITES = [
  { x: 16, y: 58, color: '#38bdf8' },
  { x: 14, y: 70, color: '#38bdf8' },
  { x: 34, y: 66, color: '#94a3b8' },
  { x: 80, y: 54, color: '#c084fc' },
  { x: 84, y: 46, color: '#c084fc' },
  { x: 60, y: 26, color: '#94a3b8' },
  { x: 68, y: 86, color: '#fbbf24' },
]

const SATELLITE_LINKS = [
  [0, 1],
  [1, 2],
  [3, 4],
]

function CriticalityGraph() {
  return (
    <div className="cg">
      <span className="cg__zone cg__zone--alpha">ZONE α // FINTECH GATEWAYS [ISOLATED]</span>
      <span className="cg__zone cg__zone--beta">ZONE β // SHELL LAYERING</span>
      <span className="cg__zone cg__zone--gamma">ZONE γ // SETTLEMENT POOLS [ISOLATED]</span>

      <svg className="cg__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {NODES.map((node) => (
          <line
            key={node.id}
            x1={CUTPOINT.x}
            y1={CUTPOINT.y}
            x2={node.x}
            y2={node.y}
            className="cg__edge cg__edge--severed"
          />
        ))}
        {SATELLITE_LINKS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={SATELLITES[a].x}
            y1={SATELLITES[a].y}
            x2={SATELLITES[b].x}
            y2={SATELLITES[b].y}
            className="cg__edge cg__edge--live"
          />
        ))}
        <line x1={NODES[1].x} y1={NODES[1].y} x2={SATELLITES[2].x} y2={SATELLITES[2].y} className="cg__edge cg__edge--live" />
        <line x1={NODES[2].x} y1={NODES[2].y} x2={SATELLITES[4].x} y2={SATELLITES[4].y} className="cg__edge cg__edge--live" />
        <line x1={NODES[3].x} y1={NODES[3].y} x2={SATELLITES[6].x} y2={SATELLITES[6].y} className="cg__edge cg__edge--live" />
      </svg>

      {SATELLITES.map((sat, i) => (
        <span
          key={i}
          className="cg__dot cg__dot--sm"
          style={{ left: `${sat.x}%`, top: `${sat.y}%`, background: sat.color }}
        />
      ))}

      {NODES.map((node) =>
        node.boxed ? (
          <div
            key={node.id}
            className="cg__entity"
            style={{ left: `${node.x}%`, top: `${node.y}%`, borderColor: `${node.color}99` }}
          >
            <span className="cg__entity-dot" style={{ background: node.color }} />
            <span className="cg__entity-label">{node.label}</span>
          </div>
        ) : (
          <div key={node.id} className="cg__plain" style={{ left: `${node.x}%`, top: `${node.y}%` }}>
            <span className="cg__entity-dot" style={{ background: node.color }} />
            <span className="cg__plain-label">{node.label}</span>
          </div>
        )
      )}

      <div className="cg__cutpoint" style={{ left: `${CUTPOINT.x}%`, top: `${CUTPOINT.y}%` }}>
        <span className="cg__cutpoint-ring" />
        <span className="cg__cutpoint-mark">✕</span>
      </div>
      <div className="cg__cutpoint-label" style={{ left: `${CUTPOINT.x}%`, top: `${CUTPOINT.y}%` }}>
        <span className="cg__cutpoint-name">[VALKYRIE HOLDINGS LTD]</span>
        <span className="cg__cutpoint-sub">REMOVED CUTPOINT // SEVERED</span>
      </div>
    </div>
  )
}

export default CriticalityGraph

import './TraceSetupSection.css'

function TraceSetupSection({ personOptions, fromId, toId, onChangeFrom, onChangeTo, onTrace, isTracing }) {
  const canTrace = Boolean(fromId) && Boolean(toId) && fromId !== toId

  return (
    <div className="tss">
      <div className="tss__row-between">
        <span className="tss__section-label">
          <span aria-hidden="true">⇄</span> PATH TRAVERSAL &amp; CORRELATION
        </span>
        <span className="tss__algo-tag">ALGO: SHORTEST PATH</span>
      </div>

      <div className="tss__endpoints">
        <div className="tss__endpoint">
          <span className="tss__endpoint-label">FROM (ORIGIN)</span>
          <div className="tss__endpoint-box">
            <select
              className="tss__endpoint-select"
              value={fromId ?? ''}
              onChange={(e) => onChangeFrom(e.target.value || null)}
            >
              <option value="">Select a person…</option>
              {personOptions.map((p) => (
                <option key={p.node_id} value={p.node_id} disabled={p.node_id === toId}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="tss__endpoint-chevron" aria-hidden="true">▾</span>
          </div>
          <span className="tss__endpoint-meta">{fromId || 'No selection'}</span>
        </div>

        <span className="tss__arrow" aria-hidden="true">
          →
        </span>

        <div className="tss__endpoint">
          <span className="tss__endpoint-label">TO (DESTINATION)</span>
          <div className="tss__endpoint-box">
            <select
              className="tss__endpoint-select"
              value={toId ?? ''}
              onChange={(e) => onChangeTo(e.target.value || null)}
            >
              <option value="">Select a person…</option>
              {personOptions.map((p) => (
                <option key={p.node_id} value={p.node_id} disabled={p.node_id === fromId}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="tss__endpoint-chevron" aria-hidden="true">▾</span>
          </div>
          <span className="tss__endpoint-meta">{toId || 'No selection'}</span>
        </div>
      </div>

      <div className="tss__row-between tss__weighting-row">
        <span className="tss__weighting">
          <span aria-hidden="true">⚙</span> Weighting: unweighted hops; strength = mean weight/(weight+1)
        </span>
        <button type="button" className="tss__trace-btn" onClick={onTrace} disabled={!canTrace || isTracing}>
          <span aria-hidden="true">↻</span> {isTracing ? 'TRACING…' : 'TRACE PATH'}
        </button>
      </div>
    </div>
  )
}

export default TraceSetupSection

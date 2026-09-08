import './PathDetailSection.css'

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

function ReturnButton({ onReturn }) {
  return (
    <button type="button" className="pds__return-btn" onClick={onReturn}>
      <span aria-hidden="true">←</span> Return to All Paths
    </button>
  )
}

function PathDetailSection({ pathLoadState, pathResult, pathErrorMessage, fromName, toName, onReturn }) {
  if (pathLoadState === 'loading') {
    return (
      <div className="pds">
        <div className="pds__state">TRACING PATH…</div>
        <ReturnButton onReturn={onReturn} />
      </div>
    )
  }

  if (pathLoadState === 'error') {
    return (
      <div className="pds">
        <div className="pds__state pds__state--error">
          <p className="pds__state-title">UNABLE TO TRACE PATH</p>
          <p className="pds__state-detail">{pathErrorMessage}</p>
        </div>
        <ReturnButton onReturn={onReturn} />
      </div>
    )
  }

  if (pathLoadState === 'no-path' || !pathResult?.path_found) {
    return (
      <div className="pds">
        <div className="pds__header">
          <span className="pds__not-found">NO PATH</span>
        </div>
        <div className="pds__state">
          NO PATH FOUND BETWEEN {fromName} AND {toName} WITHIN THE MAXIMUM SEARCH DEPTH
        </div>
        <ReturnButton onReturn={onReturn} />
      </div>
    )
  }

  const steps = pathResult.steps ?? []
  const pathNames = steps.length ? [steps[0].from, ...steps.map((s) => s.to)] : [fromName, toName]
  const intermediateNames = pathNames.slice(1, -1)

  return (
    <div className="pds">
      <div className="pds__header">
        <span className="pds__verified">
          <span className="pds__verified-dot" />
          PATH FOUND
        </span>
      </div>

      <div className="pds__meta-row">
        <span>HOPS: {pathResult.hops}</span>
        <span className="pds__strength">STRENGTH: {formatNumber(pathResult.connection_strength)}</span>
      </div>

      <h2 className="pds__title">
        {fromName} → {toName}
      </h2>

      <div className="pds__chain-row">
        <span className="pds__chain-tag">
          <span aria-hidden="true">⛓</span> {pathResult.hops}-HOP PATH
        </span>
        <span className="pds__via">
          {intermediateNames.length > 0 ? `VIA ${intermediateNames.join(', ')}` : 'DIRECT CONNECTION'}
        </span>
      </div>

      <div className="pds__stats">
        <div className="pds__stat">
          <span className="pds__stat-value">{pathResult.hops}</span>
          <span className="pds__stat-label">PATH LENGTH</span>
          <span className="pds__stat-sub">{intermediateNames.length} INTERMEDIARY</span>
        </div>
        <div className="pds__stat">
          <span className="pds__stat-value">{pathResult.total_relationship_count}</span>
          <span className="pds__stat-label">WEIGHT (ROUNDED)</span>
          <span className="pds__stat-sub">Sum of edge weights along path</span>
        </div>
        <div className="pds__stat">
          <span className="pds__stat-value">{formatNumber(pathResult.connection_strength)}</span>
          <span className="pds__stat-label">STRENGTH</span>
          <span className="pds__stat-sub">Mean weight/(weight+1)</span>
        </div>
      </div>

      {pathResult.narrative && (
        <div className="pds__narrative">
          <div className="pds__narrative-title">
            <span aria-hidden="true">▤</span> PATH NARRATIVE
          </div>
          <p className="pds__narrative-text">{pathResult.narrative}</p>
        </div>
      )}

      <div className="pds__section-row">
        <span className="pds__section-title">TRAVERSAL SEQUENCE [ {steps.length} STEPS ]</span>
      </div>

      <div className="pds__steps">
        {steps.map((step) => (
          <div className="pds-step" key={step.step}>
            <div className="pds-step__top">
              <span className="pds-step__title">
                <span className="pds-step__index">{step.step}</span>
                {step.from} → {step.to}
              </span>
              <span className="pds-step__tag pds-step__tag--default">{step.relationship_type}</span>
            </div>
            <div className="pds-step__row">
              <span className="pds-step__detail">{step.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <ReturnButton onReturn={onReturn} />
    </div>
  )
}

export default PathDetailSection

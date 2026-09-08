import './CriticalityToolbar.css'

const TOP_K_OPTIONS = [3, 6, 10]

function formatCriterion(criterion) {
  if (!criterion) return '—'
  return criterion.replace(/_/g, ' ').toUpperCase()
}

function CriticalityToolbar({ topK, onChangeTopK, criticality, criticalityLoadState, onRefresh }) {
  const finalState = criticality?.final_state

  return (
    <div className="ctb">
      <div className="ctb__row">
        <div className="ctb__field">
          <span className="ctb__field-label">TOP-K CUT:</span>
          <div className="ctb__pill-group">
            {TOP_K_OPTIONS.map((k) => (
              <button
                type="button"
                key={k}
                className={`ctb__pill${k === topK ? ' ctb__pill--active' : ''}`}
                onClick={() => onChangeTopK(k)}
                disabled={criticalityLoadState === 'loading'}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="ctb__field">
          <span className="ctb__field-label">CRITERION:</span>
          <span className="ctb__dropdown">{formatCriterion(criticality?.criterion)}</span>
        </div>

        <button type="button" className="ctb__run-btn" onClick={onRefresh} disabled={criticalityLoadState === 'loading'}>
          <span aria-hidden="true">↻</span> {criticalityLoadState === 'loading' ? 'LOADING…' : 'REFRESH RESULTS'}
        </button>
      </div>

      <div className="ctb__status-row">
        {criticalityLoadState === 'loading' && (
          <span className="ctb__status-left">
            <span className="ctb__status-dot" />
            LOADING PRECOMPUTED CRITICALITY SEQUENCE…
          </span>
        )}
        {criticalityLoadState === 'error' && (
          <span className="ctb__status-left">
            <span className="ctb__status-dot" />
            UNABLE TO LOAD CRITICALITY RESULTS
          </span>
        )}
        {criticalityLoadState === 'empty' && (
          <span className="ctb__status-left">
            <span className="ctb__status-dot" />
            NO PRECOMPUTED CRITICALITY RESULTS FOR THIS CASE
          </span>
        )}
        {criticalityLoadState === 'ready' && finalState && (
          <>
            <span className="ctb__status-left">
              <span className="ctb__status-dot" />
              PRECOMPUTED GREEDY REMOVAL SEQUENCE // EFFICIENCY DROP:{' '}
              {finalState.overall_efficiency_drop_pct.toFixed(1)}%
            </span>
            <span className="ctb__status-right">
              NETWORK DISCONNECTED: {finalState.components_created} COMPONENTS CREATED
            </span>
          </>
        )}
      </div>
    </div>
  )
}

export default CriticalityToolbar

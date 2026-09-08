import './CriticalityPanel.css'

function formatCriterion(criterion) {
  if (!criterion) return '—'
  return criterion.replace(/_/g, ' ').toUpperCase()
}

function fragmentationVariant(pct) {
  if (pct >= 50) return 'red'
  if (pct >= 20) return 'amber'
  return 'teal'
}

function CriticalityPanel({
  loadState,
  errorMessage,
  topK,
  criticality,
  criticalityLoadState,
  criticalityErrorMessage,
  selectedNodeId,
  onSelectPerson,
  onRetry,
}) {
  const isLoading = loadState === 'loading'
  const isError = loadState === 'error'
  const isNotFound = loadState === 'not-found'
  const isNoCase = loadState === 'no-case'
  const isReady = loadState === 'ready'

  const removals = criticality?.ranked_removals ?? []
  const finalState = criticality?.final_state

  return (
    <aside className="crit-panel">
      <div className="crit-panel__scroll">
        {isNoCase && <div className="crit-panel__state">RETURN TO CASES TO SELECT A CASE</div>}

        {isLoading && <div className="crit-panel__state">LOADING STRUCTURAL CRITICALITY…</div>}

        {isNotFound && <div className="crit-panel__state crit-panel__state--error">CASE NOT FOUND</div>}

        {isError && (
          <div className="crit-panel__state crit-panel__state--error">
            <p className="crit-panel__state-title">UNABLE TO LOAD STRUCTURAL CRITICALITY</p>
            <p className="crit-panel__state-detail">{errorMessage}</p>
            <button type="button" className="crit-panel__state-retry" onClick={onRetry}>
              RETRY
            </button>
          </div>
        )}

        {isReady && (
          <>
            <div className="crit-panel__header">
              <div className="crit-panel__header-row">
                <h2 className="crit-panel__title">STRUCTURAL CRITICALITY RANKING</h2>
                <span className="crit-panel__cut-tag">TOP-{topK} CUT</span>
              </div>
              <p className="crit-panel__subtitle">PERCOLATION &amp; ROBUSTNESS ANALYSIS</p>
            </div>

            {criticalityLoadState === 'loading' && (
              <div className="crit-panel__state">LOADING CRITICALITY RESULTS…</div>
            )}

            {criticalityLoadState === 'error' && (
              <div className="crit-panel__state crit-panel__state--error">
                <p className="crit-panel__state-title">UNABLE TO LOAD CRITICALITY RESULTS</p>
                <p className="crit-panel__state-detail">{criticalityErrorMessage}</p>
                <button type="button" className="crit-panel__state-retry" onClick={onRetry}>
                  RETRY
                </button>
              </div>
            )}

            {criticalityLoadState === 'empty' && (
              <div className="crit-panel__state">NO CRITICALITY RESULTS PRECOMPUTED FOR THIS CASE</div>
            )}

            {criticalityLoadState === 'ready' && criticality && (
              <>
                <div className="crit-panel__stats">
                  <div className="crit-stat">
                    <span className="crit-stat__label">INITIAL COMPONENT</span>
                    <span className="crit-stat__value">{criticality.initial_node_count} NODES</span>
                  </div>
                  <div className="crit-stat">
                    <span className="crit-stat__label">REMOVAL CRITERION</span>
                    <span className="crit-stat__value crit-stat__value--gold">
                      {formatCriterion(criticality.criterion)}
                    </span>
                    <span className="crit-stat__sub">GREEDY SEQUENTIAL REMOVAL</span>
                  </div>
                  {finalState && (
                    <>
                      <div className="crit-stat crit-stat--alert">
                        <span className="crit-stat__label">EFFICIENCY DROP</span>
                        <span className="crit-stat__value crit-stat__value--red">
                          {finalState.overall_efficiency_drop_pct.toFixed(1)}%
                        </span>
                        <span className="crit-stat__sub">AFTER TOP-{topK} REMOVAL</span>
                      </div>
                      <div className="crit-stat">
                        <span className="crit-stat__label">SECONDARY COMP.</span>
                        <span className="crit-stat__value crit-stat__value--teal">
                          {finalState.largest_remaining_component} NODES
                        </span>
                        <span className="crit-stat__sub">LARGEST REMAINING SUBGRAPH</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="crit-panel__chokepoints">
                  <div className="crit-panel__section-row">
                    <span className="crit-panel__section-title">RANKED CHOKEPOINTS</span>
                    <span className="crit-panel__step-sequence">REMOVAL SEQUENCE</span>
                  </div>

                  <div className="crit-table">
                    <div className="crit-table__head">
                      <span className="crit-table__col-rank">#</span>
                      <span className="crit-table__col-entity">CHOKEPOINT ENTITY</span>
                      <span className="crit-table__col-num">BFR</span>
                      <span className="crit-table__col-num">AFT</span>
                      <span className="crit-table__col-frg">FRG</span>
                    </div>

                    {removals.map((removal) => {
                      const isSelected = removal.node_id === selectedNodeId
                      return (
                        <div
                          className={`crit-row${isSelected ? ' crit-row--highlight' : ''}`}
                          key={removal.node_id}
                          onClick={() => onSelectPerson(removal.node_id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(evt) => {
                            if (evt.key === 'Enter' || evt.key === ' ') onSelectPerson(removal.node_id)
                          }}
                        >
                          <span className="crit-row__rank">{String(removal.rank).padStart(2, '0')}</span>
                          <span className="crit-row__entity">
                            <span className="crit-row__name">{removal.node_name || removal.node_id}</span>
                            <span
                              className={`crit-row__sub crit-row__sub--${
                                removal.entity_type_label === 'CRITICAL CUT' ? 'red' : 'default'
                              }`}
                            >
                              {removal.entity_type_label}
                            </span>
                          </span>
                          <span className="crit-row__num">{removal.component_size_before}</span>
                          <span className="crit-row__num">{removal.component_size_after}</span>
                          <span
                            className={`crit-row__frg crit-row__frg--${fragmentationVariant(removal.fragmentation_pct)}`}
                          >
                            {removal.fragmentation_pct.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {criticality.note && <p className="crit-panel__note">{criticality.note}</p>}
                </div>

                {criticality.impact_narrative && (
                  <div className="crit-panel__impact">
                    <div className="crit-panel__section-row">
                      <span className="crit-panel__impact-title">IMPACT SYNTHESIS</span>
                    </div>
                    <p className="crit-panel__impact-text">{criticality.impact_narrative}</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {isReady && criticalityLoadState === 'ready' && removals.length > 0 && (
        <div className="crit-panel__footer">
          <button type="button" className="crit-panel__btn" onClick={() => onSelectPerson(removals[0].node_id)}>
            <span aria-hidden="true">◎</span> Select Most Critical Person
          </button>
          <button type="button" className="crit-panel__btn">
            <span aria-hidden="true">⭳</span> Export Robustness Report (PDF)
          </button>
        </div>
      )}
    </aside>
  )
}

export default CriticalityPanel

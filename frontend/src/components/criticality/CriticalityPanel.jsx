import { SUMMARY, CHOKEPOINTS, IMPACT } from './criticalityData'
import './CriticalityPanel.css'

function CriticalityPanel() {
  return (
    <aside className="crit-panel">
      <div className="crit-panel__scroll">
        <div className="crit-panel__header">
          <div className="crit-panel__header-row">
            <h2 className="crit-panel__title">STRUCTURAL CRITICALITY RANKING</h2>
            <span className="crit-panel__cut-tag">{SUMMARY.cutLabel}</span>
          </div>
          <p className="crit-panel__subtitle">PERCOLATION &amp; ROBUSTNESS ANALYSIS</p>
        </div>

        <div className="crit-panel__stats">
          <div className="crit-stat">
            <span className="crit-stat__label">INITIAL COMPONENT</span>
            <span className="crit-stat__value">{SUMMARY.initialNodes} NODES</span>
            <span className="crit-stat__sub">{SUMMARY.reachablePct}</span>
          </div>
          <div className="crit-stat">
            <span className="crit-stat__label">REMOVAL CRITERION</span>
            <span className="crit-stat__value crit-stat__value--gold">{SUMMARY.removalCriterion}</span>
            <span className="crit-stat__sub">{SUMMARY.removalSub}</span>
          </div>
          <div className="crit-stat crit-stat--alert">
            <span className="crit-stat__label">FRAGMENTATION</span>
            <span className="crit-stat__value crit-stat__value--red">{SUMMARY.fragmentation}</span>
            <span className="crit-stat__sub">{SUMMARY.fragmentationSub}</span>
          </div>
          <div className="crit-stat">
            <span className="crit-stat__label">SECONDARY COMP.</span>
            <span className="crit-stat__value crit-stat__value--teal">{SUMMARY.secondaryNodes} NODES</span>
            <span className="crit-stat__sub">{SUMMARY.secondarySub}</span>
          </div>
        </div>

        <div className="crit-panel__chokepoints">
          <div className="crit-panel__section-row">
            <span className="crit-panel__section-title">RANKED CHOKEPOINTS</span>
            <span className="crit-panel__step-sequence">STEP SEQUENCE</span>
          </div>

          <div className="crit-table">
            <div className="crit-table__head">
              <span className="crit-table__col-rank">#</span>
              <span className="crit-table__col-entity">CHOKEPOINT ENTITY</span>
              <span className="crit-table__col-num">BFR</span>
              <span className="crit-table__col-num">AFT</span>
              <span className="crit-table__col-frg">FRG</span>
            </div>

            {CHOKEPOINTS.map((cp) => (
              <div className={`crit-row${cp.highlight ? ' crit-row--highlight' : ''}`} key={cp.rank}>
                <span className="crit-row__rank">{String(cp.rank).padStart(2, '0')}</span>
                <span className="crit-row__entity">
                  <span className="crit-row__name">{cp.name}</span>
                  <span className={`crit-row__sub crit-row__sub--${cp.subVariant}`}>{cp.sub}</span>
                </span>
                <span className="crit-row__num">{cp.bfr}</span>
                <span className="crit-row__num">{cp.aft}</span>
                <span className={`crit-row__frg crit-row__frg--${cp.frgVariant}`}>{cp.frg}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="crit-panel__impact">
          <div className="crit-panel__section-row">
            <span className="crit-panel__impact-title">IMPACT SYNTHESIS</span>
            <span className="crit-panel__impact-tag">ISOLATION CRITICAL</span>
          </div>
          <p className="crit-panel__impact-text">
            Hypothetical severing of <strong>{IMPACT.entity}</strong> creates a catastrophic percolation
            collapse, decomposing the network into {IMPACT.components} disjoint subnetworks with an
            efficiency decline of <strong className="crit-panel__impact-decline">{IMPACT.decline}</strong>.
          </p>
        </div>
      </div>

      <div className="crit-panel__footer">
        <button type="button" className="crit-panel__btn">
          <span aria-hidden="true">◎</span> Apply Cutpoint Mask to Viewport
        </button>
        <button type="button" className="crit-panel__btn">
          <span aria-hidden="true">⭳</span> Export Robustness Report (PDF)
        </button>
      </div>
    </aside>
  )
}

export default CriticalityPanel

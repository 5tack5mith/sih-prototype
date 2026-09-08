import { TRACE } from './pathData'
import './TraceSetupSection.css'

function TraceSetupSection({ onTrace }) {
  return (
    <div className="tss">
      <div className="tss__row-between">
        <span className="tss__section-label">
          <span aria-hidden="true">⇄</span> PATH TRAVERSAL &amp; CORRELATION
        </span>
        <span className="tss__algo-tag">ALGO: {TRACE.algorithm}</span>
      </div>

      <div className="tss__endpoints">
        <div className="tss__endpoint">
          <span className="tss__endpoint-label">FROM (ORIGIN)</span>
          <div className="tss__endpoint-box">
            <span className="tss__endpoint-name">{TRACE.from.name}</span>
            <span className="tss__endpoint-chevron">▾</span>
          </div>
          <span className="tss__endpoint-meta">{TRACE.from.meta}</span>
        </div>

        <span className="tss__arrow" aria-hidden="true">
          →
        </span>

        <div className="tss__endpoint">
          <span className="tss__endpoint-label">TO (DESTINATION)</span>
          <div className="tss__endpoint-box">
            <span className="tss__endpoint-name">{TRACE.to.name}</span>
            <span className="tss__endpoint-chevron">▾</span>
          </div>
          <span className="tss__endpoint-meta">{TRACE.to.meta}</span>
        </div>
      </div>

      <div className="tss__row-between tss__weighting-row">
        <span className="tss__weighting">
          <span aria-hidden="true">⚙</span> Weighting: {TRACE.weighting}
        </span>
        <button type="button" className="tss__trace-btn" onClick={onTrace}>
          <span aria-hidden="true">↻</span> TRACE PATH
        </button>
      </div>
    </div>
  )
}

export default TraceSetupSection

import { useState } from 'react'
import './CriticalityToolbar.css'

const TOP_K_OPTIONS = [3, 6, 10]
const STEPS = [1, 2, 3, 4, 5]

function CriticalityToolbar({ onRunSimulation }) {
  const [topK, setTopK] = useState(6)
  const [activeStep] = useState(2)

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
                onClick={() => setTopK(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="ctb__field">
          <span className="ctb__field-label">CRITERION:</span>
          <span className="ctb__dropdown">
            Percolation / Global Efficiency Disruption
            <span className="ctb__dropdown-chevron">⌄</span>
          </span>
        </div>

        <button type="button" className="ctb__run-btn" onClick={onRunSimulation}>
          <span aria-hidden="true">↻</span> RUN SIMULATION
        </button>
      </div>

      <div className="ctb__steps-row">
        <div className="ctb__transport">
          <button type="button">⏮</button>
          <button type="button" className="ctb__transport-play">
            ⏸
          </button>
          <button type="button">⏭</button>
        </div>

        <div className="ctb__steps">
          {STEPS.map((step, i) => (
            <div className="ctb__step-group" key={step}>
              {i > 0 && (
                <span className={`ctb__step-line${step <= activeStep ? ' ctb__step-line--done' : ''}`} />
              )}
              <span
                className={`ctb__step${
                  step === activeStep
                    ? ' ctb__step--active'
                    : step < activeStep
                      ? ' ctb__step--done'
                      : ''
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>

        <span className="ctb__step-tooltip">[VALKYRIE HOLDINGS LTD]</span>
      </div>

      <div className="ctb__status-row">
        <span className="ctb__status-left">
          <span className="ctb__status-dot" />
          TOPOLOGICAL PERCOLATION IN PROGRESS // ISOLATION FACTOR: 78.4%
        </span>
        <span className="ctb__status-right">NETWORK DISCONNECTED: 3 DISJOINT COMPONENTS CREATED</span>
      </div>
    </div>
  )
}

export default CriticalityToolbar

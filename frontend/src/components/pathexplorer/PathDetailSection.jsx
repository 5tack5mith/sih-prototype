import { PATH_DETAIL, TRACE } from './pathData'
import './PathDetailSection.css'

function PathDetailSection({ onReturn }) {
  return (
    <div className="pds">
      <div className="pds__header">
        <button type="button" className="pds__back" onClick={onReturn}>
          <span aria-hidden="true">←</span> Return to All Paths
        </button>
        <span className="pds__verified">
          <span className="pds__verified-dot" />
          PATH VERIFIED
        </span>
      </div>

      <div className="pds__meta-row">
        <span>PATH ID: [{PATH_DETAIL.pathId}]</span>
        <span className="pds__strength">STRENGTH: {PATH_DETAIL.strength}</span>
      </div>

      <h2 className="pds__title">{PATH_DETAIL.title}</h2>

      <div className="pds__chain-row">
        <span className="pds__chain-tag">
          <span aria-hidden="true">⛓</span> {PATH_DETAIL.chainLabel}
        </span>
        <span className="pds__via">{PATH_DETAIL.viaLabel}</span>
      </div>

      <div className="pds__stats">
        {PATH_DETAIL.stats.map((stat) => (
          <div className="pds__stat" key={stat.label}>
            <span className="pds__stat-value">
              {stat.value}
              {stat.unit ? <span className="pds__stat-unit"> {stat.unit}</span> : null}
            </span>
            <span className="pds__stat-label">{stat.label}</span>
            <span className="pds__stat-sub">{stat.sub}</span>
          </div>
        ))}
      </div>

      <div className="pds__section-row">
        <span className="pds__section-title">TRAVERSAL SEQUENCE [ {PATH_DETAIL.steps.length} STEPS ]</span>
        <span className="pds__correlated">100% CORRELATED</span>
      </div>

      <div className="pds__steps">
        {PATH_DETAIL.steps.map((step) => (
          <div className="pds-step" key={step.index}>
            <div className="pds-step__top">
              <span className="pds-step__title">
                <span className="pds-step__index">{step.index}</span>
                {step.title}
              </span>
              <span className={`pds-step__tag pds-step__tag--${step.statusVariant}`}>{step.statusTag}</span>
            </div>
            <div className="pds-step__row">
              <span>
                From: <strong>{step.from}</strong> To: <strong>{step.to}</strong>
              </span>
            </div>
            <div className="pds-step__row pds-step__row--between">
              <span className="pds-step__detail">{step.detail}</span>
              <span
                className={`pds-step__right${
                  step.rightVariant === 'gold' ? ' pds-step__right--gold' : ''
                }`}
              >
                {step.right}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="pds__section-row">
        <span className="pds__section-title">PATH CORROBORATION // EVIDENCE</span>
        <span className="pds__chronological">CHRONOLOGICAL</span>
      </div>

      <button type="button" className="pds__evidence-btn">
        <span aria-hidden="true">▤</span> VIEW EVIDENCE ({TRACE.evidenceCount} RECORDS)
      </button>

      <div className="pds__timeline">
        {PATH_DETAIL.evidence.map((item) => (
          <div className="pds-event" key={item.time}>
            <span className={`pds-event__dot${item.accent ? ' pds-event__dot--gold' : ''}`} />
            <span className={`pds-event__time${item.accent ? ' pds-event__time--gold' : ''}`}>
              {item.time}
            </span>
            <p className="pds-event__text">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PathDetailSection

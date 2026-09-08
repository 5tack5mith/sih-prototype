import './CommunityGraphBar.css'

function CommunityGraphBar({ cluster, onBack }) {
  return (
    <div className="cgb">
      <div className="cgb__left">
        <span className="cgb__dot" style={{ background: cluster.color }} />
        <span className="cgb__label">
          COMMUNITY VIEW: {cluster.name.split(':')[0].toUpperCase()} // {cluster.name.split(':')[1]?.trim().toUpperCase()}
        </span>
        <span className="cgb__sep">|</span>
        <span className="cgb__item">MEMBERS: {cluster.size}</span>
        <span className="cgb__sep">|</span>
        <span className="cgb__item">INTRA-DEN: {cluster.internalDensity.toFixed(2)}</span>
      </div>
      <div className="cgb__right">
        <button type="button" className="cgb__back" onClick={onBack}>
          Return to Communities Overview
        </button>
        <button type="button">+</button>
        <button type="button">−</button>
        <button type="button">⛶</button>
        <button type="button">||</button>
      </div>
    </div>
  )
}

export default CommunityGraphBar

import { communityColor } from '../overview/graphLayout'
import './CommunityGraphBar.css'

function CommunityGraphBar({ summary, detail, onBack }) {
  const communityId = detail?.community_id ?? summary?.community_id
  const color = communityColor(communityId)
  const label = summary?.label || (communityId !== undefined ? `Cluster ${communityId}` : 'Community')
  const size = detail?.size ?? summary?.size
  const internalDensity = detail?.internal_density ?? summary?.internal_density

  return (
    <div className="cgb">
      <div className="cgb__left">
        <span className="cgb__dot" style={{ background: color }} />
        <span className="cgb__label">COMMUNITY VIEW: {label.toUpperCase()}</span>
        <span className="cgb__sep">|</span>
        <span className="cgb__item">MEMBERS: {size ?? '…'}</span>
        <span className="cgb__sep">|</span>
        <span className="cgb__item">
          INTRA-DEN: {internalDensity === null || internalDensity === undefined ? '…' : internalDensity.toFixed(2)}
        </span>
      </div>
      <div className="cgb__right">
        <button type="button" className="cgb__back" onClick={onBack}>
          Return to Communities Overview
        </button>
      </div>
    </div>
  )
}

export default CommunityGraphBar

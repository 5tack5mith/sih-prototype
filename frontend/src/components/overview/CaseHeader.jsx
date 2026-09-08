import netraLogo from '../../assets/overview/netra-logo-28.png'
import backArrowIcon from '../../assets/overview/back-arrow.svg'
import caseFolderIcon from '../../assets/overview/case-folder.svg'
import searchIcon from '../../assets/overview/search.svg'
import userAvatarIcon from '../../assets/overview/user-avatar.svg'
import './CaseHeader.css'

function CaseHeader({ onBack, caseLabel }) {
  return (
    <header className="case-header">
      <div className="case-header__left">
        <div className="case-header__brand">
          <img className="case-header__logo" src={netraLogo} alt="" />
          <span className="case-header__brand-name">NETRA</span>
        </div>
        <div className="case-header__divider" />
        <button type="button" className="case-header__back" onClick={onBack}>
          <img src={backArrowIcon} alt="" />
          <span>Back to Cases</span>
        </button>
        <div className="case-header__divider" />
        <button type="button" className="case-header__case-icon" title={caseLabel}>
          <img src={caseFolderIcon} alt="" />
        </button>
      </div>

      <div className="case-header__search">
        <img className="case-header__search-icon" src={searchIcon} alt="" />
        <input
          className="case-header__search-input"
          type="text"
          placeholder="Search this case (entities, hashes, transactions)..."
        />
        <span className="case-header__search-kbd">⌘K</span>
      </div>

      <div className="case-header__right">
        <div className="case-header__status">
          <span className="case-header__status-dot" />
          <span>ENCLAVE ACTIVE</span>
        </div>
        <div className="case-header__user">
          <span className="case-header__user-name">AN-84920 · S. CHEN</span>
          <span className="case-header__user-sec">// SEC-LEVEL 4</span>
        </div>
        <div className="case-header__avatar">
          <img src={userAvatarIcon} alt="" />
        </div>
      </div>
    </header>
  )
}

export default CaseHeader

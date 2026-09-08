import netraLogo from '../assets/cases/netra-logo.png'
import searchIcon from '../assets/cases/search.svg'
import userIcon from '../assets/cases/user.svg'
import './AppHeader.css'

function AppHeader({ searchQuery = '', onSearchChange }) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <div className="app-header__brand">
          <img className="app-header__logo" src={netraLogo} alt="" />
          <span className="app-header__brand-name">NETRA</span>
          <span className="app-header__version">// v4.2</span>
        </div>

        <div className="app-header__search">
          <img className="app-header__search-icon" src={searchIcon} alt="" />
          <input
            className="app-header__search-input"
            type="text"
            placeholder="SEARCH CASES BY ID OR NAME..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          <span className="app-header__search-kbd">⌘K</span>
        </div>
      </div>

      <div className="app-header__right">
        <div className="app-header__status">
          <span className="app-header__status-dot" />
          <span>ENCLAVE ACTIVE</span>
        </div>
        <div className="app-header__divider" />
        <div className="app-header__user">
          <div className="app-header__user-text">
            <span className="app-header__user-name">AN-84920 · S. CHEN</span>
            <span className="app-header__user-role">SEC-LEVEL 4 // LEAD ANALYST</span>
          </div>
          <div className="app-header__avatar">
            <img src={userIcon} alt="" />
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader

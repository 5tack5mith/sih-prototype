import { useAuth } from '../auth/AuthContext'
import netraLogo from '../assets/cases/netra-logo.png'
import searchIcon from '../assets/cases/search.svg'
import userIcon from '../assets/cases/user.svg'
import './AppHeader.css'

function AppHeader({ searchQuery = '', onSearchChange, onBrandClick }) {
  const { username, role, logout } = useAuth()
  const BrandTag = onBrandClick ? 'button' : 'div'
  return (
    <header className="app-header">
      <div className="app-header__left">
        <BrandTag
          type={onBrandClick ? 'button' : undefined}
          className={`app-header__brand${onBrandClick ? ' app-header__brand--button' : ''}`}
          onClick={onBrandClick}
        >
          <img className="app-header__logo" src={netraLogo} alt="" />
          <span className="app-header__brand-name">NEXUS</span>
        </BrandTag>

        <div className="app-header__search">
          <img className="app-header__search-icon" src={searchIcon} alt="" />
          <input
            className="app-header__search-input"
            type="text"
            placeholder="SEARCH CASES BY ID OR NAME..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
      </div>

      <div className="app-header__right">
        <div className="app-header__status">
          <span className="app-header__status-dot" />
          <span>SYSTEM ACTIVE</span>
        </div>
        <div className="app-header__divider" />
        <button type="button" className="app-header__user" onClick={logout} title="Sign out" aria-label="Sign out">
          <div className="app-header__user-text">
            <span className="app-header__user-name">{username}</span>
            <span className="app-header__user-role">{role}</span>
          </div>
          <div className="app-header__avatar">
            <img src={userIcon} alt="" />
          </div>
        </button>
      </div>
    </header>
  )
}

export default AppHeader

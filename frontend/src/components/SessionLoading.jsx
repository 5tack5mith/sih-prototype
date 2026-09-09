import logoMark from '../assets/login/logo-mark.svg'
import './Login.css'

function SessionLoading() {
  return (
    <div className="login-screen" aria-busy="true" aria-live="polite">
      <div className="login-screen__gradient" />
      <header className="login-header">
        <div className="login-header__group">
          <span className="login-header__dot" />
          <span className="login-header__label">NETRA // SYS_AUTH_T1</span>
        </div>
        <div className="login-header__group">
          <span className="login-header__meta">ENC: AES-256-GCM</span>
          <span className="login-header__meta login-header__meta--accent">SECURE_NODE</span>
        </div>
      </header>
      <main className="login-main">
        <div className="login-banner">
          <span className="login-banner__dot" />
          RESTORING SECURE SESSION
        </div>
        <div className="login-brand">
          <img className="login-brand__mark" src={logoMark} alt="" />
          <div className="login-brand__text">
            <h1 className="login-brand__name">NETRA</h1>
            <p className="login-brand__tagline">AUTHENTICATING SESSION</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SessionLoading

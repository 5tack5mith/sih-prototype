import { useState } from 'react'
import { login } from '../api/client'
import logoMark from '../assets/login/logo-mark.svg'
import statusShield from '../assets/login/status-shield.svg'
import eyeToggle from '../assets/login/eye-toggle.svg'
import arrowRight from '../assets/login/arrow-right.svg'
import './Login.css'

function Login({ onLogin }) {
  const [analystId, setAnalystId] = useState('')
  const [passkey, setPasskey] = useState('')
  const [showPasskey, setShowPasskey] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setErrorMessage(null)
    if (!analystId.trim() || !passkey) {
      setErrorMessage('Analyst ID and passkey are required.')
      return
    }
    setSubmitting(true)
    try {
      await login(analystId.trim(), passkey)
      onLogin?.()
    } catch (err) {
      setErrorMessage(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
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
          RESTRICTED ACCESS · AUTHORIZED PERSONNEL ONLY
        </div>

        <div className="login-brand">
          <img className="login-brand__mark" src={logoMark} alt="" />
          <div className="login-brand__text">
            <h1 className="login-brand__name">NETRA</h1>
            <p className="login-brand__tagline">V3.4.1 SECURE GATEWAY // ANALYTICAL MATRIX</p>
          </div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card__header">
            <div className="login-card__header-group">
              <img className="login-card__shield" src={statusShield} alt="" />
              <span className="login-card__title">TERMINAL AUTHENTICATION</span>
            </div>
            <div className="login-card__header-group">
              <span className="login-card__status-dot" />
              <span className="login-card__status">ENCLAVE_READY</span>
            </div>
          </div>

          <div className="login-card__body">
            <div className="login-field">
              <div className="login-field__row">
                <span className="login-field__label">
                  ANALYST ID <span className="login-field__required">*</span>
                </span>
                <span className="login-field__hint">ISO-C2</span>
              </div>
              <input
                className="login-field__input"
                type="text"
                placeholder="e.g. AN-84920"
                value={analystId}
                onChange={(event) => setAnalystId(event.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="login-field">
              <div className="login-field__row">
                <span className="login-field__label">
                  CRYPTOGRAPHIC PASSKEY <span className="login-field__required">*</span>
                </span>
                <span className="login-field__hint">GCM_TOKEN</span>
              </div>
              <div className="login-field__input-wrap">
                <input
                  className="login-field__input"
                  type={showPasskey ? 'text' : 'password'}
                  placeholder="••••••••••••••••"
                  value={passkey}
                  onChange={(event) => setPasskey(event.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-field__toggle"
                  onClick={() => setShowPasskey((value) => !value)}
                  aria-label={showPasskey ? 'Hide passkey' : 'Show passkey'}
                >
                  <img src={eyeToggle} alt="" />
                </button>
              </div>
            </div>

            <label className="login-ack">
              <input
                type="checkbox"
                className="login-ack__checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span className="login-ack__label">
                Acknowledge all network activity is logged under Title 18 USC § 1030 jurisdiction.
              </span>
            </label>

            <div className="login-actions">
              {errorMessage && <p className="login-error">{errorMessage}</p>}
              <button type="submit" className="login-submit" disabled={submitting}>
                {submitting ? 'AUTHENTICATING…' : 'SIGN IN TO ENCLAVE'}
                <img className="login-submit__icon" src={arrowRight} alt="" />
              </button>
              <div className="login-actions__links">
                <span>FORGOT ACCESS / KEY REISSUE?</span>
                <span>P-KEY // 4096</span>
              </div>
            </div>
          </div>

          <div className="login-card__footer">
            <span>SECURITY PROTOCOL</span>
            <span className="login-card__footer-accent">MIL-STD-810G</span>
          </div>
        </form>

        <div className="login-sysline">
          <span className="login-sysline__dim">SYS_BUILD: 2025.04-R2 </span>
          <span className="login-sysline__bright">·</span>
          <span className="login-sysline__dim">NODE: SEC-CLUSTER-US-EAST</span>
          <span className="login-sysline__bright">·</span>
          <span className="login-sysline__dim">ENCRYPTION: AES-256-GCM</span>
          <span className="login-sysline__bright">·</span>
          <span className="login-sysline__bright">SECURE SESSION #NX-8821</span>
        </div>
      </main>

      <footer className="login-footer">
        <span>SYS_LOC: 40.7128° N, 74.0060° W // TERMINAL: 0x88F2</span>
        <span>RESTRICTED INVESTIGATIVE DOCKET CLASSIFICATION LEVEL 4</span>
      </footer>
    </div>
  )
}

export default Login

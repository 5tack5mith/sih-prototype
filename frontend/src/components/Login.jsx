import { useState } from 'react'
import { login } from '../api/client'
import logoMark from '../assets/login/logo-mark.svg'
import eyeToggle from '../assets/login/eye-toggle.svg'
import loginBackground from '../assets/login/login-background.png'
import './Login.css'

function ShieldIcon() {
  return (
    <svg width="19" height="24" viewBox="0 0 14 17.5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 17.5C4.97292 16.99 3.29948 15.8265 1.98 14.0095C0.66 12.1953 0 10.1792 0 7.9625V2.625L7 0L14 2.625V7.9625C14 10.1792 13.34 12.1953 12.02 14.0095C10.7005 15.8265 9.02708 16.99 7 17.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path d="M4.7 8.6L6.4 10.3L9.6 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function InvestigatorIcon() {
  return (
    <svg width="21" height="19" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 6C6.38071 6 7.5 4.88071 7.5 3.5C7.5 2.11929 6.38071 1 5 1C3.61929 1 2.5 2.11929 2.5 3.5C2.5 4.88071 3.61929 6 5 6V6M0.5 11.5V10.5C0.5 8.567 2.067 7 4 7H6C7.933 7 9.5 8.567 9.5 10.5V11.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 1.1084C10.361 1.42945 10.9673 2.25623 10.9673 3.22321C10.9673 4.19018 10.361 5.01696 9.5 5.33801M11.9673 11.5V10.5C11.9642 8.83485 10.8404 7.38187 9.23193 6.96387"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ROLE_COPY = {
  admin: {
    label: 'Administrator',
    description: 'Full system access and configuration',
  },
  investigator: {
    label: 'Investigator',
    description: 'Analyst access and investigation tools',
  },
}

function Login({ onLogin }) {
  // Role selection is a purely visual first step (frames which sign-in
  // experience the analyst is entering) - it never talks to the backend.
  // The credential step underneath is unchanged: it still submits to the
  // real /login endpoint via api/client's login(), and the account's own
  // role (not whichever card was clicked) is what the server returns.
  const [step, setStep] = useState('role')
  const [role, setRole] = useState(null)
  const [analystId, setAnalystId] = useState('')
  const [passkey, setPasskey] = useState('')
  const [showPasskey, setShowPasskey] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSelectRole = (selectedRole) => {
    setRole(selectedRole)
    setStep('credentials')
    setErrorMessage(null)
  }

  const handleBack = () => {
    setStep('role')
    setErrorMessage(null)
  }

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

  const roleCopy = role ? ROLE_COPY[role] : null

  return (
    <div
      className="login-screen"
      style={{
        // The source artwork is a wide banner with its network clusters
        // weighted to the two edges and a plain dark middle - full-bleed
        // `cover` on a tall/narrow viewport would crop straight through
        // those clusters and show only the empty middle. Anchoring the SAME
        // image twice, once pinned to each edge at full viewport height,
        // keeps both clusters visible at any viewport size; the dark gap
        // between them matches the panel's own dark background regardless.
        backgroundImage: `url(${loginBackground}), url(${loginBackground})`,
        backgroundPosition: 'left center, right center',
        backgroundSize: 'auto 100%, auto 100%',
        backgroundRepeat: 'no-repeat, no-repeat',
      }}
    >
      <main className="login-main">
        <div className="login-brand">
          <img className="login-brand__mark" src={logoMark} alt="" />
          <span className="login-brand__name">NEXUS</span>
        </div>

        <div className="login-panel">
          {step === 'role' ? (
            <div className="login-role">
              <h1 className="login-role__title">Select your access level</h1>
              <p className="login-role__subtitle">Sign in to continue</p>

              <div className="login-role__cards">
                <button
                  type="button"
                  className="login-role-card login-role-card--admin"
                  onClick={() => handleSelectRole('admin')}
                >
                  <span className="login-role-card__icon">
                    <ShieldIcon />
                  </span>
                  <span className="login-role-card__name">{ROLE_COPY.admin.label}</span>
                  <span className="login-role-card__desc">{ROLE_COPY.admin.description}</span>
                  <span className="login-role-card__arrow">
                    <ArrowIcon />
                  </span>
                </button>

                <button
                  type="button"
                  className="login-role-card login-role-card--investigator"
                  onClick={() => handleSelectRole('investigator')}
                >
                  <span className="login-role-card__icon">
                    <InvestigatorIcon />
                  </span>
                  <span className="login-role-card__name">{ROLE_COPY.investigator.label}</span>
                  <span className="login-role-card__desc">{ROLE_COPY.investigator.description}</span>
                  <span className="login-role-card__arrow">
                    <ArrowIcon />
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <form className={`login-form login-form--${role}`} onSubmit={handleSubmit}>
              <button type="button" className="login-form__back" onClick={handleBack}>
                ← Change access level
              </button>

              <h1 className="login-form__title">{roleCopy.label} Sign-In</h1>

              <div className="login-field">
                <label className="login-field__label" htmlFor="login-analyst-id">
                  Analyst ID
                </label>
                <input
                  id="login-analyst-id"
                  className="login-field__input"
                  type="text"
                  placeholder="e.g. AN-84920"
                  value={analystId}
                  onChange={(event) => setAnalystId(event.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="login-field">
                <label className="login-field__label" htmlFor="login-passkey">
                  Passkey
                </label>
                <div className="login-field__input-wrap">
                  <input
                    id="login-passkey"
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

              {errorMessage && <p className="login-error">{errorMessage}</p>}

              <button type="submit" className="login-submit" disabled={submitting}>
                {submitting ? 'Authenticating…' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}

export default Login

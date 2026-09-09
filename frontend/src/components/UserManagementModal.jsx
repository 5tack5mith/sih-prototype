import { useEffect, useState } from 'react'
import { createUser, listUsers } from '../api/adminApi'
import './CreateCaseModal.css'

function UserManagementModal({ onClose }) {
  const [users, setUsers] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('investigator')

  const refresh = async () => {
    const next = await listUsers()
    setUsers(next)
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    refresh().catch((err) => setLoadError(err.message || 'Unable to load users.'))
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const trimmed = username.trim()
    if (!trimmed || !password) {
      setSubmitError('Username and password are required.')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    try {
      await createUser({ username: trimmed, password, role })
      setUsername('')
      setPassword('')
      setRole('investigator')
      await refresh()
    } catch (err) {
      setSubmitError(err.message || 'Unable to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="create-case-overlay" role="presentation">
      <div className="create-case-modal" role="dialog" aria-modal="true" aria-labelledby="user-management-title">
        <header className="create-case-modal__header">
          <div>
            <h2 id="user-management-title" className="create-case-modal__title">
              User Management
            </h2>
            <p className="create-case-modal__subtitle">Authorized accounts · Admin only</p>
          </div>
          <button type="button" className="create-case-modal__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
        </header>

        <div className="create-case-modal__form">
          {loadError && <p className="create-case-field__error">{loadError}</p>}
          <div className="create-case-field">
            <span className="create-case-field__label">Accounts</span>
            <ul className="admin-list">
              {users.map((user) => (
                <li key={user.username} className="admin-list__row">
                  <span>{user.username}</span>
                  <span className="admin-list__meta">{user.role}</span>
                </li>
              ))}
              {users.length === 0 && !loadError && <li className="admin-list__empty">No accounts found.</li>}
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="create-case-field-grid">
              <div className="create-case-field">
                <label className="create-case-field__label" htmlFor="new-user-name">
                  Username
                </label>
                <input
                  id="new-user-name"
                  className="create-case-field__input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="create-case-field">
                <label className="create-case-field__label" htmlFor="new-user-password">
                  Password
                </label>
                <input
                  id="new-user-password"
                  className="create-case-field__input"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="create-case-field create-case-field--spaced">
              <label className="create-case-field__label" htmlFor="new-user-role">
                Role
              </label>
              <select
                id="new-user-role"
                className="create-case-field__select"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              >
                <option value="investigator">investigator</option>
                <option value="admin">admin</option>
              </select>
            </div>
            {submitError && <p className="create-case-field__error">{submitError}</p>}
            <div className="create-case-modal__actions create-case-modal__actions--spaced">
              <button type="button" className="create-case-modal__cancel" onClick={onClose}>
                Close
              </button>
              <button type="submit" className="create-case-modal__submit" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default UserManagementModal

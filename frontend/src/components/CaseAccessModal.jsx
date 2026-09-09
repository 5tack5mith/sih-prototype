import { useEffect, useState } from 'react'
import { assignInvestigator, loadCaseAccess, unassignInvestigator } from '../api/adminApi'
import './CreateCaseModal.css'

function CaseAccessModal({ caseRecord, onClose }) {
  const [investigators, setInvestigators] = useState([])
  const [assigned, setAssigned] = useState(new Set())
  const [errorMessage, setErrorMessage] = useState(null)
  const [pending, setPending] = useState(null)

  const refresh = async () => {
    const next = await loadCaseAccess(caseRecord.case_id)
    setInvestigators(next.investigators)
    setAssigned(new Set(next.assigned))
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    refresh().catch((err) => setErrorMessage(err.message || 'Unable to load case access.'))
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [caseRecord.case_id, onClose])

  const toggle = async (username, isAssigned) => {
    setErrorMessage(null)
    setPending(username)
    try {
      if (isAssigned) {
        await unassignInvestigator(caseRecord.case_id, username)
      } else {
        await assignInvestigator(caseRecord.case_id, username)
      }
      await refresh()
    } catch (err) {
      setErrorMessage(err.message || 'Unable to update assignment.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="create-case-overlay" role="presentation">
      <div className="create-case-modal" role="dialog" aria-modal="true" aria-labelledby="case-access-title">
        <header className="create-case-modal__header">
          <div>
            <h2 id="case-access-title" className="create-case-modal__title">
              Case Access
            </h2>
            <p className="create-case-modal__subtitle">
              {caseRecord.case_id} · {caseRecord.name || 'Untitled case'}
            </p>
          </div>
          <button type="button" className="create-case-modal__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
        </header>

        <div className="create-case-modal__form">
          {errorMessage && <p className="create-case-field__error">{errorMessage}</p>}
          <ul className="admin-list">
            {investigators.map((user) => {
              const isAssigned = assigned.has(user.username)
              return (
                <li key={user.username} className="admin-list__row">
                  <span>{user.username}</span>
                  <span className="admin-list__meta">{isAssigned ? 'Assigned' : 'Not assigned'}</span>
                  <button
                    type="button"
                    className="admin-list__action"
                    disabled={pending === user.username}
                    onClick={() => toggle(user.username, isAssigned)}
                  >
                    {isAssigned ? 'Remove' : 'Assign'}
                  </button>
                </li>
              )
            })}
            {investigators.length === 0 && !errorMessage && (
              <li className="admin-list__empty">No investigator accounts found.</li>
            )}
          </ul>
          <div className="create-case-modal__actions">
            <button type="button" className="create-case-modal__cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CaseAccessModal

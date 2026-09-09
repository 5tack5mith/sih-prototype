import { useEffect, useId, useRef, useState } from 'react'
import './CreateCaseModal.css'
import './EditCaseModal.css'

const PRIORITY_OPTIONS = [
  { value: 'I', label: 'Priority I (Critical)' },
  { value: 'II', label: 'Priority II (Active / High)' },
  { value: 'III', label: 'Priority III (Standard)' },
  { value: 'IV', label: 'Priority IV (Low)' },
]

const JURISDICTION_OPTIONS = [
  { value: 'CYBER-INTEL', label: 'CYBER-INTEL (Mixers & Bridge Tracking)' },
  { value: 'FINANCIAL CRIMES', label: 'FINANCIAL CRIMES' },
  { value: 'ORGANIZED CRIME', label: 'ORGANIZED CRIME' },
  { value: 'DIGITAL FORENSICS', label: 'DIGITAL FORENSICS' },
  { value: 'INTERSTATE OPERATIONS', label: 'INTERSTATE OPERATIONS' },
]

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.csv', '.json', '.pcap', '.pdf']

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtensionAllowed(name) {
  const lower = name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function formatLastModified(iso) {
  if (!iso) return 'N/A'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function normalizePriority(value) {
  if (!value) return 'II'
  const raw = String(value).trim()
  const roman = raw.match(/\b(IV|III|II|I)\b/i)
  if (roman) return roman[1].toUpperCase()
  const upper = raw.toUpperCase()
  if (upper.includes('CRITICAL')) return 'I'
  if (upper.includes('HIGH') || upper.includes('ACTIVE')) return 'II'
  if (upper.includes('STANDARD')) return 'III'
  if (upper.includes('LOW')) return 'IV'
  return 'II'
}

export function normalizeJurisdiction(value) {
  if (!value) return 'CYBER-INTEL'
  const upper = String(value).trim().toUpperCase()
  const match = JURISDICTION_OPTIONS.find(
    (option) => upper === option.value || upper.startsWith(option.value)
  )
  return match?.value ?? 'CYBER-INTEL'
}

function EditCaseModal({ caseRecord, onClose, onSave }) {
  const fileInputId = useId()
  const fileInputRef = useRef(null)
  const [caseName, setCaseName] = useState(caseRecord?.name || '')
  const [nameError, setNameError] = useState(null)
  const [priority, setPriority] = useState(normalizePriority(caseRecord?.priority))
  const [jurisdiction, setJurisdiction] = useState(normalizeJurisdiction(caseRecord?.jurisdiction_tag))
  const [summary, setSummary] = useState(caseRecord?.description || '')
  const [attachments, setAttachments] = useState(() =>
    (caseRecord?.attachments || []).map((file, index) => ({
      id: file.id || `${file.name}-${index}`,
      name: file.name,
      size: file.size,
      status: file.status || 'INGESTED',
    }))
  )
  const [fileError, setFileError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const caseId = caseRecord?.case_id || ''
  const lead = caseRecord?.lead_analyst || 'UNASSIGNED'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || [])
    if (incoming.length === 0) return

    const next = [...attachments]
    let error = null
    for (const file of incoming) {
      if (!fileExtensionAllowed(file.name)) {
        error = 'Supported types: CSV, JSON, PCAP, PDF.'
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        error = 'File exceeds 50MB limit.'
        continue
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        status: 'STAGED',
      })
    }
    setAttachments(next)
    setFileError(error)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedName = caseName.trim()
    if (!trimmedName) {
      setNameError('Case name is required.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await onSave?.({
        case_id: caseId,
        name: trimmedName,
        priority,
        description: summary.trim() || null,
        jurisdiction_tag: jurisdiction,
        attachments: attachments.map(({ name, size, status }) => ({ name, size, status })),
        lead_analyst: lead,
        status: caseRecord?.status,
        node_count: caseRecord?.node_count,
        edge_count: caseRecord?.edge_count,
      })
    } catch (err) {
      setSaveError(err.message || 'Failed to save case changes.')
      setSaving(false)
    }
  }

  return (
    <div className="create-case-overlay edit-case-overlay" role="presentation">
      <div
        className="create-case-modal edit-case-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-case-title"
      >
        <header className="create-case-modal__header">
          <div>
            <h2 id="edit-case-title" className="create-case-modal__title">
              MODIFICATION PROTOCOL
            </h2>
            <p className="edit-case-modal__dossier">EDIT CASE DOSSIER // {caseId}</p>
            <p className="create-case-modal__subtitle">
              DOCKET REPOSITORY MODIFICATION · ENCLAVE VERIFIED
            </p>
          </div>
          <button type="button" className="create-case-modal__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
        </header>

        <form className="create-case-modal__form edit-case-modal__form" onSubmit={handleSubmit}>
          <div className="edit-case-modal__body">
            <div className="create-case-field">
              <div className="create-case-field__row">
                <label className="create-case-field__label" htmlFor="edit-case-name">
                  CASE NAME / OPERATION CODENAME
                </label>
                <span className="create-case-field__mark create-case-field__mark--required">REQUIRED *</span>
              </div>
              <input
                id="edit-case-name"
                className="create-case-field__input"
                type="text"
                value={caseName}
                onChange={(event) => {
                  setCaseName(event.target.value)
                  if (nameError) setNameError(null)
                }}
              />
              {nameError && <p className="create-case-field__error">{nameError}</p>}
            </div>

            <div className="create-case-field-grid">
              <div className="create-case-field">
                <div className="create-case-field__row">
                  <label className="create-case-field__label" htmlFor="edit-case-id">
                    DOCKET / CASE ID
                  </label>
                </div>
                <div className="create-case-field__id">
                  <span className="create-case-field__hash" aria-hidden="true">
                    #
                  </span>
                  <input
                    id="edit-case-id"
                    className="create-case-field__input create-case-field__input--id"
                    type="text"
                    value={caseId}
                    readOnly
                  />
                </div>
              </div>

              <div className="create-case-field">
                <div className="create-case-field__row">
                  <label className="create-case-field__label" htmlFor="edit-case-priority">
                    PRIORITY CLASSIFICATION
                  </label>
                </div>
                <select
                  id="edit-case-priority"
                  className="create-case-field__select"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="create-case-field">
              <div className="create-case-field__row">
                <label className="create-case-field__label" htmlFor="edit-case-jurisdiction">
                  JURISDICTION / ENFORCEMENT ZONE
                </label>
              </div>
              <select
                id="edit-case-jurisdiction"
                className="create-case-field__select"
                value={jurisdiction}
                onChange={(event) => setJurisdiction(event.target.value)}
              >
                {JURISDICTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="create-case-field">
              <div className="create-case-field__row">
                <label className="create-case-field__label" htmlFor="edit-case-summary">
                  CASE SCOPE & HYPOTHESIS SUMMARY
                </label>
                <span className="create-case-field__mark">OPTIONAL</span>
              </div>
              <textarea
                id="edit-case-summary"
                className="create-case-field__textarea"
                rows={4}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>

            <div className="create-case-field">
              <div className="create-case-field__row">
                <span className="create-case-field__label">EVIDENCE & SOURCE ATTACHMENTS</span>
                <span className="create-case-field__mark">OPTIONAL · UP TO 50MB (CSV, JSON, PCAP, PDF)</span>
              </div>
              <div
                className={`create-case-dropzone${dragging ? ' create-case-dropzone--active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  addFiles(event.dataTransfer.files)
                }}
              >
                <span className="create-case-dropzone__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M7 3h7l5 5v13H7V3z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                    />
                    <path d="M14 3v5h5" fill="none" stroke="currentColor" strokeWidth="1.25" />
                    <path d="M12 11v6M9 14h6" stroke="currentColor" strokeWidth="1.25" />
                  </svg>
                </span>
                <span className="create-case-dropzone__copy">
                  Drag & drop evidentiary artifacts, raw transaction ledgers, or graph exports here, or{' '}
                  <button
                    type="button"
                    className="create-case-dropzone__browse"
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    browse files
                  </button>
                </span>
              </div>
              <input
                id={fileInputId}
                ref={fileInputRef}
                className="create-case-dropzone__input"
                type="file"
                accept=".csv,.json,.pcap,.pdf"
                multiple
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
              <p className="create-case-dropzone__status">ENCLAVE ENCRYPTED ON INGESTION // SHA-256 VERIFIED</p>
              {fileError && <p className="create-case-field__error">{fileError}</p>}
              {attachments.length > 0 && (
                <ul className="create-case-files">
                  {attachments.map((file) => (
                    <li key={file.id} className="create-case-files__row">
                      <span className="create-case-files__icon" aria-hidden="true">
                        <svg viewBox="0 0 16 16">
                          <path
                            d="M4 1.5h5.5L13 5v9.5H4v-13z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.1"
                          />
                          <path d="M9.5 1.5V5H13" fill="none" stroke="currentColor" strokeWidth="1.1" />
                        </svg>
                      </span>
                      <span className="create-case-files__meta">
                        <span className="create-case-files__name">{file.name}</span>
                        {file.size != null && (
                          <span className="create-case-files__size">{formatFileSize(file.size)}</span>
                        )}
                      </span>
                      <span className="create-case-files__staged">[{file.status || 'STAGED'}]</span>
                      <button
                        type="button"
                        className="create-case-files__remove"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== file.id))}
                      >
                        <svg viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.25" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {saveError && <p className="create-case-field__error">{saveError}</p>}

          <footer className="create-case-modal__footer edit-case-modal__footer">
            <div className="edit-case-modal__meta">
              <div className="create-case-modal__lead">
                <span className="create-case-modal__lead-dot" />
                LEAD: {lead}
              </div>
              <div className="edit-case-modal__modified">LAST MODIFIED: {formatLastModified(caseRecord?.updated_at)}</div>
            </div>
            <div className="create-case-modal__actions">
              <button type="button" className="create-case-modal__cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="create-case-modal__submit" disabled={saving}>
                Save Changes
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default EditCaseModal

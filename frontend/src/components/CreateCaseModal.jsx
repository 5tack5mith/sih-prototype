import { useEffect, useId, useRef, useState } from 'react'
import plusIcon from '../assets/cases/plus.svg'
import './CreateCaseModal.css'

const PRIORITY_OPTIONS = [
  { value: 'I', label: 'Priority I (Critical)' },
  { value: 'II', label: 'Priority II (Active / High)' },
  { value: 'III', label: 'Priority III (Standard)' },
  { value: 'IV', label: 'Priority IV (Low)' },
]

const JURISDICTION_OPTIONS = [
  'CYBER-INTEL',
  'FINANCIAL CRIMES',
  'ORGANIZED CRIME',
  'DIGITAL FORENSICS',
  'INTERSTATE OPERATIONS',
]

const CASE_LEAD = 'AN-84920'
const MAX_FILE_BYTES = 50 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['.csv', '.json', '.pcap', '.pdf']

export function generateCaseId(existingIds) {
  const used = new Set(existingIds)
  const now = new Date()
  const year = now.getFullYear()
  const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  let candidate = `NX-${year}-${mmdd}`
  if (!used.has(candidate)) return candidate
  let n = 2
  while (used.has(`NX-${year}-${mmdd}-${String(n).padStart(2, '0')}`)) n += 1
  return `NX-${year}-${mmdd}-${String(n).padStart(2, '0')}`
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileExtensionAllowed(name) {
  const lower = name.toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function CreateCaseModal({ existingCaseIds, onClose, onCreate }) {
  const fileInputId = useId()
  const fileInputRef = useRef(null)
  const [caseId] = useState(() => generateCaseId(existingCaseIds))
  const [caseName, setCaseName] = useState('')
  const [nameError, setNameError] = useState(null)
  const [priority, setPriority] = useState('II')
  const [jurisdiction, setJurisdiction] = useState('CYBER-INTEL')
  const [summary, setSummary] = useState('')
  const [attachments, setAttachments] = useState([])
  const [fileError, setFileError] = useState(null)
  const [dragging, setDragging] = useState(false)

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
      })
    }
    setAttachments(next)
    setFileError(error)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const trimmedName = caseName.trim()
    if (!trimmedName) {
      setNameError('Case name is required.')
      return
    }

    const now = new Date().toISOString()
    onCreate?.({
      case_id: caseId,
      name: trimmedName,
      status: 'ACTIVE',
      priority,
      description: summary.trim() || null,
      node_count: 0,
      edge_count: 0,
      updated_at: now,
      created_at: now,
      lead_analyst: CASE_LEAD,
      jurisdiction_tag: jurisdiction,
      attachments: attachments.map(({ name, size }) => ({ name, size })),
    })
  }

  return (
    <div className="create-case-overlay" role="presentation">
      <div
        className="create-case-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-case-title"
      >
        <header className="create-case-modal__header">
          <div>
            <h2 id="create-case-title" className="create-case-modal__title">
              + CREATE NEW CASE
            </h2>
            <p className="create-case-modal__subtitle">DOCKET REPOSITORY CREATION · SYSTEM VERIFIED</p>
          </div>
          <button type="button" className="create-case-modal__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.25" />
            </svg>
          </button>
        </header>

        <form className="create-case-modal__form" onSubmit={handleSubmit}>
          <div className="create-case-field">
            <div className="create-case-field__row">
              <label className="create-case-field__label" htmlFor="create-case-name">
                CASE NAME / OPERATION CODENAME
              </label>
              <span className="create-case-field__mark create-case-field__mark--required">REQUIRED *</span>
            </div>
            <input
              id="create-case-name"
              className="create-case-field__input"
              type="text"
              placeholder="e.g., Operation Silverline"
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
                <label className="create-case-field__label" htmlFor="create-case-id">
                  DOCKET / CASE ID
                </label>
                <span className="create-case-field__mark">AUTO-GEN</span>
              </div>
              <div className="create-case-field__id">
                <span className="create-case-field__hash" aria-hidden="true">
                  #
                </span>
                <input
                  id="create-case-id"
                  className="create-case-field__input create-case-field__input--id"
                  type="text"
                  value={caseId}
                  readOnly
                />
              </div>
            </div>

            <div className="create-case-field">
              <div className="create-case-field__row">
                <label className="create-case-field__label" htmlFor="create-case-priority">
                  PRIORITY CLASSIFICATION
                </label>
              </div>
              <select
                id="create-case-priority"
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
              <label className="create-case-field__label" htmlFor="create-case-jurisdiction">
                JURISDICTION / ENFORCEMENT ZONE
              </label>
            </div>
            <select
              id="create-case-jurisdiction"
              className="create-case-field__select"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value)}
            >
              {JURISDICTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="create-case-field">
            <div className="create-case-field__row">
              <label className="create-case-field__label" htmlFor="create-case-summary">
                CASE SCOPE & HYPOTHESIS SUMMARY
              </label>
              <span className="create-case-field__mark">OPTIONAL</span>
            </div>
            <textarea
              id="create-case-summary"
              className="create-case-field__textarea"
              rows={4}
              placeholder="Brief operational synopsis, suspected topology, entities of interest..."
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
            <p className="create-case-dropzone__status">SYSTEM ENCRYPTED ON INGESTION // SHA-256 VERIFIED</p>
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
                    <span className="create-case-files__name">
                      {file.name} ({formatFileSize(file.size)})
                    </span>
                    <span className="create-case-files__staged">[STAGED]</span>
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

          <footer className="create-case-modal__footer">
            <div className="create-case-modal__lead">
              <span className="create-case-modal__lead-dot" />
              LEAD: {CASE_LEAD}
            </div>
            <div className="create-case-modal__actions">
              <button type="button" className="create-case-modal__cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="create-case-modal__submit">
                <img src={plusIcon} alt="" />
                Create Case
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}

export default CreateCaseModal

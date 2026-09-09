import { useState } from 'react'
import netraLogo from '../../assets/overview/netra-logo-28.png'
import backArrowIcon from '../../assets/overview/back-arrow.svg'
import caseFolderIcon from '../../assets/overview/case-folder.svg'
import searchIcon from '../../assets/overview/search.svg'
import userAvatarIcon from '../../assets/overview/user-avatar.svg'
import './CaseHeader.css'

const MAX_RESULTS = 5

function CaseHeader({ onBack, caseLabel, cases = [], onSelectCase, personNodes = [], onSelectPerson }) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const trimmed = query.trim().toLowerCase()
  const caseMatches = trimmed
    ? cases
        .filter((c) => {
          const id = (c.case_id || '').toLowerCase()
          const name = (c.name || '').toLowerCase()
          return id.includes(trimmed) || name.includes(trimmed)
        })
        .slice(0, MAX_RESULTS)
    : []
  const personMatches = trimmed
    ? personNodes
        .filter((n) => {
          const id = String(n.node_id ?? '').toLowerCase()
          const name = (n.name || '').toLowerCase()
          return id.includes(trimmed) || name.includes(trimmed)
        })
        .slice(0, MAX_RESULTS)
    : []
  const showDropdown = isFocused && trimmed.length > 0
  const hasMatches = caseMatches.length > 0 || personMatches.length > 0

  const handleSelectCase = (caseItem) => {
    onSelectCase?.(caseItem)
    setQuery('')
    setIsFocused(false)
  }

  const handleSelectPerson = (personNode) => {
    onSelectPerson?.(personNode.node_id)
    setQuery('')
    setIsFocused(false)
  }

  return (
    <header className="case-header">
      <div className="case-header__left">
        <div className="case-header__brand">
          <img className="case-header__logo" src={netraLogo} alt="" />
          <span className="case-header__brand-name">NEXUS</span>
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
          placeholder="Search cases or persons by ID/name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {showDropdown && (
          <div className="case-header__search-dropdown">
            {!hasMatches ? (
              <div className="case-header__search-empty">NO CASES OR PERSONS FOUND</div>
            ) : (
              <>
                {caseMatches.length > 0 && (
                  <div className="case-header__search-group">
                    <span className="case-header__search-group-label">CASES</span>
                    {caseMatches.map((c) => (
                      <button
                        type="button"
                        key={c.case_id}
                        className="case-header__search-item"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectCase(c)
                        }}
                      >
                        <span className="case-header__search-item-id">{c.case_id}</span>
                        <span className="case-header__search-item-name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {personMatches.length > 0 && (
                  <div className="case-header__search-group">
                    <span className="case-header__search-group-label">PERSONS</span>
                    {personMatches.map((n) => (
                      <button
                        type="button"
                        key={n.node_id}
                        className="case-header__search-item"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelectPerson(n)
                        }}
                      >
                        <span className="case-header__search-item-id">{n.node_id}</span>
                        <span className="case-header__search-item-name">{n.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="case-header__right">
        <div className="case-header__status">
          <span className="case-header__status-dot" />
          <span>SYSTEM ACTIVE</span>
        </div>
        <div className="case-header__avatar">
          <img src={userAvatarIcon} alt="" />
        </div>
      </div>
    </header>
  )
}

export default CaseHeader

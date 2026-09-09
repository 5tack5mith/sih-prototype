import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import CreateCaseModal from '../components/CreateCaseModal'
import { fetchCases } from '../api/casesApi'
import gridViewIcon from '../assets/cases/grid-view.svg'
import listViewIcon from '../assets/cases/list-view.svg'
import plusIcon from '../assets/cases/plus.svg'
import sortArrowIcon from '../assets/cases/sort-arrow.svg'
import topology1 from '../assets/cases/topology-1.svg'
import topology2 from '../assets/cases/topology-2.svg'
import topology3 from '../assets/cases/topology-3.svg'
import topology4 from '../assets/cases/topology-4.svg'
import topology5 from '../assets/cases/topology-5.svg'
import topology6 from '../assets/cases/topology-6.svg'
import './Cases.css'

const TOPOLOGIES = [topology1, topology2, topology3, topology4, topology5, topology6]

const TABS = [
  { key: 'all', label: 'All Cases' },
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Completed' },
  { key: 'flagged', label: 'Important' },
]

function formatRelativeTime(iso) {
  if (!iso) return 'N/A'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'N/A'

  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

// Maps a GET /cases row (app/api/models.py:CaseSummary) onto the card's display shape.
function mapCaseToCard(apiCase, index) {
  const isArchived = (apiCase.status || '').toLowerCase() === 'archived'

  return {
    id: apiCase.case_id,
    archived: isArchived,
    status: isArchived ? 'ARCHIVED' : 'ACTIVE',
    title: apiCase.name || apiCase.case_id,
    docket: `DOCKET // ${apiCase.case_id}${apiCase.priority ? ` · PRIORITY ${apiCase.priority}` : ''}`,
    description: apiCase.description || 'No description on file.',
    topology: TOPOLOGIES[index % TOPOLOGIES.length],
    nodes: String(apiCase.node_count ?? 0),
    edges: String(apiCase.edge_count ?? 0),
    updated: formatRelativeTime(apiCase.updated_at),
    lead: apiCase.lead_analyst || 'UNASSIGNED',
  }
}

function CaseCard({ caseItem, starred, onToggleStar, onOpen }) {
  return (
    <article
      className={`case-card${caseItem.archived ? ' case-card--archived' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.()
        }
      }}
    >
      <button
        type="button"
        className={`case-card__star${starred ? ' case-card__star--on' : ''}`}
        aria-label={starred ? 'Unstar case' : 'Star case'}
        aria-pressed={starred}
        onClick={(event) => {
          event.stopPropagation()
          onToggleStar?.()
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M6 1.15 7.38 3.95l3.1.45-2.24 2.18.53 3.08L6 8.2l-2.77 1.46.53-3.08L1.52 4.4l3.1-.45L6 1.15z"
            fill={starred ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1"
          />
        </svg>
      </button>
      <div className="case-card__body">
        <div className="case-card__top">
          <div className="case-card__heading">
            <div className="case-card__badges">
              <span className={`case-card__status case-card__status--${caseItem.status.toLowerCase()}`}>
                {caseItem.status}
              </span>
            </div>
            <h2 className="case-card__title">{caseItem.title}</h2>
          </div>
          <div className="case-card__topology">
            <img src={caseItem.topology} alt="" />
          </div>
        </div>

        <p className="case-card__docket">{caseItem.docket}</p>

        <p className="case-card__summary">
          <span>{caseItem.description}</span>
        </p>
      </div>

      <div className="case-card__footer">
        <div className="case-card__stats">
          <div className="case-card__stat">
            <span className="case-card__stat-label">NODES</span>
            <span className="case-card__stat-value">{caseItem.nodes}</span>
          </div>
          <div className="case-card__stat">
            <span className="case-card__stat-label">EDGES</span>
            <span className="case-card__stat-value">{caseItem.edges}</span>
          </div>
          <div className="case-card__stat">
            <span className="case-card__stat-label">UPDATED</span>
            <span className="case-card__stat-value case-card__stat-value--plain">{caseItem.updated}</span>
          </div>
        </div>
        <div className="case-card__meta">
          <span>LEAD: {caseItem.lead}</span>
        </div>
      </div>
    </article>
  )
}

function Cases({ onOpenCase }) {
  const [sort, setSort] = useState('last_activity')
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [fetchedCases, setFetchedCases] = useState([])
  const [createdCases, setCreatedCases] = useState([])
  const [loadState, setLoadState] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [starredIds, setStarredIds] = useState(() => new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const all = await fetchCases({ sort })
        if (cancelled) return
        setFetchedCases(all)
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err.message || 'Failed to load cases')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [sort, retryToken])

  useEffect(() => {
    if (!successMessage) return undefined
    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  const allCases = useMemo(() => {
    const remoteIds = new Set(fetchedCases.map((c) => c.case_id))
    const local = createdCases.filter((c) => !remoteIds.has(c.case_id))
    const merged = [...local, ...fetchedCases]
    if (sort !== 'name') return merged
    return [...merged].sort((a, b) =>
      (a.name || a.case_id).localeCompare(b.name || b.case_id, undefined, { sensitivity: 'base' })
    )
  }, [fetchedCases, createdCases, sort])

  const activeCases = useMemo(
    () => allCases.filter((c) => (c.status || '').toLowerCase() !== 'archived'),
    [allCases]
  )
  const archivedCases = useMemo(
    () => allCases.filter((c) => (c.status || '').toLowerCase() === 'archived'),
    [allCases]
  )
  const importantCases = useMemo(
    () => allCases.filter((c) => starredIds.has(c.case_id)),
    [allCases, starredIds]
  )

  const total = allCases.length
  const activeCount = activeCases.length
  const archivedCount = archivedCases.length
  const flaggedCount = importantCases.length

  const tabCases =
    activeTab === 'active'
      ? activeCases
      : activeTab === 'archived'
        ? archivedCases
        : activeTab === 'flagged'
          ? importantCases
          : allCases

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const displayedCases = trimmedQuery
    ? tabCases.filter((c) => {
        const id = (c.case_id || '').toLowerCase()
        const name = (c.name || '').toLowerCase()
        return id.includes(trimmedQuery) || name.includes(trimmedQuery)
      })
    : tabCases

  const tabCounts = { all: total, active: activeCount, archived: archivedCount, flagged: flaggedCount }

  return (
    <div className="cases-page">
      <AppHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="cases-main">
        <div className="cases-toolbar">
          <div className="cases-toolbar__left">
            <div className="cases-heading">
              <h1>Cases</h1>
              <span className="cases-heading__badge">
                [ {total} TOTAL // {activeCount} ACTIVE ]
              </span>
            </div>
          </div>
          <div className="cases-toolbar__right">
            <div className="cases-view-switch">
              <button
                type="button"
                className={`cases-view-switch__btn${viewMode === 'grid' ? ' cases-view-switch__btn--active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <img src={gridViewIcon} alt="Grid view" />
              </button>
              <button
                type="button"
                className={`cases-view-switch__btn${viewMode === 'list' ? ' cases-view-switch__btn--active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <img src={listViewIcon} alt="List view" />
              </button>
            </div>
            <div className="cases-toolbar__divider" />
            <button type="button" className="cases-new-btn" onClick={() => setCreateOpen(true)}>
              <img src={plusIcon} alt="" />
              New Case
            </button>
          </div>
        </div>

        {successMessage && <p className="cases-create-success">{successMessage}</p>}

        <div className="cases-filters">
          <div className="cases-filters__left">
            {TABS.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={`cases-filter-pill${activeTab === tab.key ? ' cases-filter-pill--active' : ''}${
                  tab.key === 'flagged' ? ' cases-filter-pill--flagged' : ''
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.key === 'flagged' && <span className="cases-filter-pill__dot" />}
                {tab.label} ({tabCounts[tab.key]})
              </button>
            ))}
          </div>
          <div className="cases-filters__right">
            <span className="cases-filters__sort-label">SORT BY:</span>
            <div
              className="cases-sort"
              role="button"
              tabIndex={0}
              onClick={() => setSort((s) => (s === 'last_activity' ? 'name' : 'last_activity'))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSort((s) => (s === 'last_activity' ? 'name' : 'last_activity'))
                }
              }}
            >
              <span>{sort === 'name' ? 'Name ↓' : 'Last Activity ↓'}</span>
              <img src={sortArrowIcon} alt="" />
            </div>
          </div>
        </div>

        {loadState === 'loading' ? (
          <div className="cases-state">LOADING CASES…</div>
        ) : loadState === 'error' ? (
          <div className="cases-state cases-state--error">
            <p className="cases-state__title">UNABLE TO LOAD CASES</p>
            <p className="cases-state__detail">{errorMessage}</p>
            <button type="button" className="cases-state__retry" onClick={() => setRetryToken((t) => t + 1)}>
              RETRY
            </button>
          </div>
        ) : displayedCases.length === 0 ? (
          <div className="cases-state">NO CASES FOUND</div>
        ) : (
          <div className={`cases-grid${viewMode === 'list' ? ' cases-grid--list' : ''}`}>
            {displayedCases.map((apiCase, index) => {
              const caseItem = mapCaseToCard(apiCase, index)
              return (
                <CaseCard
                  key={caseItem.id}
                  caseItem={caseItem}
                  starred={starredIds.has(caseItem.id)}
                  onToggleStar={() => {
                    setStarredIds((prev) => {
                      const next = new Set(prev)
                      if (next.has(caseItem.id)) next.delete(caseItem.id)
                      else next.add(caseItem.id)
                      return next
                    })
                  }}
                  onOpen={() => onOpenCase?.(caseItem)}
                />
              )
            })}
          </div>
        )}

        <div className="cases-status-bar">
          <div className="cases-status-bar__left">
            <span className="cases-status-bar__item cases-status-bar__item--nominal">
              <span className="cases-status-bar__dot" />
              CLUSTER HEALTH: NOMINAL
            </span>
            <span className="cases-status-bar__sep">|</span>
            <span className="cases-status-bar__item">INGESTION RATE: 42.8 TX/S</span>
            <span className="cases-status-bar__sep">|</span>
            <span className="cases-status-bar__item">ACTIVE RECURSION DEPTH: 4</span>
          </div>
          <div className="cases-status-bar__right">
            <span className="cases-status-bar__item">SYNC HASH: 0x9bf4...e881</span>
            <span className="cases-status-bar__item cases-status-bar__item--link">EXPORT AUDIT DOCKET →</span>
          </div>
        </div>
      </main>

      {createOpen && (
        <CreateCaseModal
          existingCaseIds={allCases.map((c) => c.case_id)}
          onClose={() => setCreateOpen(false)}
          onCreate={(created) => {
            setCreatedCases((prev) => [created, ...prev])
            setCreateOpen(false)
            setSuccessMessage('Case created successfully.')
            if (activeTab === 'archived' || activeTab === 'flagged') setActiveTab('all')
          }}
        />
      )}
    </div>
  )
}

export default Cases

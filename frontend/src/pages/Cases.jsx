import { useEffect, useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
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
  { key: 'archived', label: 'Archived' },
  { key: 'flagged', label: 'Flagged Focus' },
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
    jurisdiction: apiCase.jurisdiction_tag || 'UNSPECIFIED',
  }
}

function CaseCard({ caseItem, onOpen }) {
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
          <span>JURISDICTION: {caseItem.jurisdiction}</span>
        </div>
      </div>
    </article>
  )
}

function Cases({ onOpenCase }) {
  const [sort, setSort] = useState('last_activity')
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [allCases, setAllCases] = useState([])
  const [flaggedCases, setFlaggedCases] = useState([])
  const [loadState, setLoadState] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const [all, flagged] = await Promise.all([
          fetchCases({ sort }),
          fetchCases({ sort, filter: 'flagged' }),
        ])
        if (cancelled) return
        setAllCases(all)
        setFlaggedCases(flagged)
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

  const activeCases = useMemo(
    () => allCases.filter((c) => (c.status || '').toLowerCase() !== 'archived'),
    [allCases]
  )
  const archivedCases = useMemo(
    () => allCases.filter((c) => (c.status || '').toLowerCase() === 'archived'),
    [allCases]
  )

  const total = allCases.length
  const activeCount = activeCases.length
  const archivedCount = archivedCases.length
  const flaggedCount = flaggedCases.length

  const tabCases =
    activeTab === 'active'
      ? activeCases
      : activeTab === 'archived'
        ? archivedCases
        : activeTab === 'flagged'
          ? flaggedCases
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
              <span className="cases-heading__repo">
                <span className="cases-heading__dot" />
                INDEXED REPOSITORY
              </span>
            </div>
          </div>
          <div className="cases-toolbar__right">
            <div className="cases-view-switch">
              <button type="button" className="cases-view-switch__btn cases-view-switch__btn--active">
                <img src={gridViewIcon} alt="Grid view" />
              </button>
              <button type="button" className="cases-view-switch__btn">
                <img src={listViewIcon} alt="List view" />
              </button>
            </div>
            <div className="cases-toolbar__divider" />
            <button type="button" className="cases-new-btn">
              <img src={plusIcon} alt="" />
              New Case
            </button>
          </div>
        </div>

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
          <div className="cases-grid">
            {displayedCases.map((apiCase, index) => {
              const caseItem = mapCaseToCard(apiCase, index)
              return <CaseCard key={caseItem.id} caseItem={caseItem} onOpen={() => onOpenCase?.(caseItem)} />
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
    </div>
  )
}

export default Cases

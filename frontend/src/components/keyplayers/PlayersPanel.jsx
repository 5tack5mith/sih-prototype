import downloadIcon from '../../assets/keyplayers/download-icon.svg'
import './PlayersPanel.css'

const TOP_DISPLAY_COUNT = 10

const SORT_TABS = [
  { key: 'betweenness', label: 'Betweenness' },
  { key: 'eigenvector', label: 'Eigen' },
  { key: 'degree', label: 'Degree' },
]

function formatRank(rank) {
  return `#${String(rank).padStart(2, '0')}`
}

function formatScore(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return '—'
  return score.toFixed(3)
}

function buildRows(players) {
  const displayed = players.slice(0, TOP_DISPLAY_COUNT)
  const maxScore = Math.max(...displayed.map((p) => p.score ?? 0), 0.0001)

  return displayed.map((player) => ({
    rank: player.rank,
    nodeId: player.node_id,
    name: player.name || player.node_id,
    tag: (player.entity_type || 'PERSON').toUpperCase(),
    score: formatScore(player.score),
    barPct: Math.max(2, Math.round(((player.score ?? 0) / maxScore) * 100)),
  }))
}

function PlayersPanel({
  loadState,
  errorMessage,
  players,
  sortMetric,
  onChangeSortMetric,
  selectedNodeId,
  onSelectPerson,
  onHoverPerson,
  onHoverEnd,
  nodeDetail,
  detailLoadState,
  onRetry,
}) {
  const isLoading = loadState === 'loading'
  const isError = loadState === 'error'
  const isNotFound = loadState === 'not-found'
  const isNoCase = loadState === 'no-case'
  const isReady = loadState === 'ready'

  const rows = isReady ? buildRows(players ?? []) : []

  return (
    <aside className="kp-panel">
      <div className="kp-panel__header">
        <div className="kp-panel__header-top">
          <div className="kp-panel__title-row">
            <h2 className="kp-panel__title">Key Players</h2>
            <span className="kp-panel__top10-tag">TOP {TOP_DISPLAY_COUNT}</span>
          </div>
          <button type="button" className="kp-panel__download">
            <img src={downloadIcon} alt="Export" />
          </button>
        </div>
        <div className="kp-panel__sort-row">
          <span className="kp-panel__ranked-by">RANKED BY CENTRALITY ↓</span>
          <div className="kp-panel__sort-tabs">
            {SORT_TABS.map((tab, index) => (
              <span key={tab.key} className="kp-panel__sort-tab-group">
                {index > 0 && <span className="kp-panel__sort-sep">|</span>}
                <button
                  type="button"
                  className={`kp-panel__sort-tab${tab.key === sortMetric ? ' kp-panel__sort-tab--active' : ''}`}
                  onClick={() => onChangeSortMetric?.(tab.key)}
                  disabled={!isReady}
                >
                  {tab.label}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {isNoCase && <div className="kp-panel__state">RETURN TO CASES TO SELECT A CASE</div>}

      {isLoading && <div className="kp-panel__state">LOADING KEY PLAYERS…</div>}

      {isNotFound && <div className="kp-panel__state kp-panel__state--error">CASE NOT FOUND</div>}

      {isError && (
        <div className="kp-panel__state kp-panel__state--error">
          <p className="kp-panel__state-title">UNABLE TO LOAD KEY PLAYERS</p>
          <p className="kp-panel__state-detail">{errorMessage}</p>
          <button type="button" className="kp-panel__state-retry" onClick={onRetry}>
            RETRY
          </button>
        </div>
      )}

      {isReady && rows.length === 0 && (
        <div className="kp-panel__state">NO RANKED PLAYERS AVAILABLE FOR THIS CASE</div>
      )}

      {isReady && rows.length > 0 && (
        <>
          <div className="kp-panel__scroll">
            {rows.map((row) => {
              const isSelected = row.nodeId === selectedNodeId
              return (
                <div
                  key={row.nodeId}
                  className={`kp-row${isSelected ? ' kp-row--top' : ''}`}
                  onClick={() => onSelectPerson?.(row.nodeId)}
                  onMouseEnter={() => onHoverPerson?.(row.nodeId)}
                  onMouseLeave={() => onHoverEnd?.()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(evt) => {
                    if (evt.key === 'Enter' || evt.key === ' ') onSelectPerson?.(row.nodeId)
                  }}
                >
                  <div className="kp-row__top">
                    <span className="kp-row__name">
                      <span className={`kp-row__rank${isSelected ? ' kp-row__rank--top' : ''}`}>
                        {formatRank(row.rank)}
                      </span>
                      <span className={`kp-row__name-text${isSelected ? ' kp-row__name-text--top' : ''}`}>
                        {row.name}
                      </span>
                    </span>
                    <span className="kp-row__right">
                      <span className="kp-row__tag kp-row__tag--default">{row.tag}</span>
                      <span className="kp-row__score">{row.score}</span>
                    </span>
                  </div>
                  <div className="kp-row__bar-track">
                    <span
                      className={`kp-row__bar-fill${isSelected ? ' kp-row__bar-fill--top' : ''}`}
                      style={{ width: `${row.barPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="kp-panel__dossier">
            {detailLoadState === 'loading' && (
              <div className="kp-panel__state kp-panel__state--inline">LOADING DOSSIER…</div>
            )}
            {detailLoadState === 'error' && (
              <div className="kp-panel__state kp-panel__state--inline kp-panel__state--error">
                UNABLE TO LOAD PERSON DETAIL
              </div>
            )}
            {detailLoadState === 'not-found' && (
              <div className="kp-panel__state kp-panel__state--inline">PERSON NOT FOUND</div>
            )}
            {detailLoadState === 'ready' && nodeDetail && (
              <>
                <div className="kp-dossier__header">
                  <span className="kp-dossier__name">
                    <span className="kp-dossier__icon" aria-hidden="true">
                      ◆
                    </span>
                    {nodeDetail.name || nodeDetail.node_id}
                  </span>
                  <span className="kp-dossier__tag">
                    {(nodeDetail.structural_role || nodeDetail.entity_type || 'PERSON').toUpperCase()}
                  </span>
                </div>
                <div className="kp-dossier__stats">
                  <div className="kp-dossier__stat">
                    <span className="kp-dossier__stat-value">{nodeDetail.connection_count ?? '—'}</span>
                    <span className="kp-dossier__stat-label">DEGREE</span>
                  </div>
                  <div className="kp-dossier__stat">
                    <span className="kp-dossier__stat-value kp-dossier__stat-value--gold">
                      {formatScore(nodeDetail.scores?.betweenness)}
                    </span>
                    <span className="kp-dossier__stat-label">BETWEENNESS</span>
                  </div>
                  <div className="kp-dossier__stat">
                    <span className="kp-dossier__stat-value">{formatScore(nodeDetail.scores?.eigenvector)}</span>
                    <span className="kp-dossier__stat-label">EIGENVECTOR</span>
                  </div>
                </div>
                <button type="button" className="kp-dossier__btn">
                  VIEW FULL ENTITY LEDGER →
                </button>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

export default PlayersPanel

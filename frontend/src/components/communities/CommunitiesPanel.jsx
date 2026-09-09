import ClusterListView from './ClusterListView'
import ClusterDetailView from './ClusterDetailView'
import './CommunitiesPanel.css'

function CommunitiesPanel({
  caseId,
  loadState,
  errorMessage,
  communities,
  modularity,
  selectedId,
  detail,
  detailLoadState,
  onSelect,
  onBack,
  onRetry,
}) {
  const isLoading = loadState === 'loading'
  const isError = loadState === 'error'
  const isNotFound = loadState === 'not-found'
  const isNoCase = loadState === 'no-case'
  const isReady = loadState === 'ready'

  return (
    <aside className="cp-panel">
      {isNoCase && <div className="cp-panel__state">RETURN TO CASES TO SELECT A CASE</div>}

      {isLoading && <div className="cp-panel__state">LOADING COMMUNITIES…</div>}

      {isNotFound && <div className="cp-panel__state cp-panel__state--error">CASE NOT FOUND</div>}

      {isError && (
        <div className="cp-panel__state cp-panel__state--error">
          <p className="cp-panel__state-title">UNABLE TO LOAD COMMUNITIES</p>
          <p className="cp-panel__state-detail">{errorMessage}</p>
          <button type="button" className="cp-panel__state-retry" onClick={onRetry}>
            RETRY
          </button>
        </div>
      )}

      {isReady && selectedId ? (
        <ClusterDetailView
          caseId={caseId}
          communityId={selectedId}
          displayRank={communities.find((c) => c.community_id === selectedId)?.displayRank}
          detail={detail}
          detailLoadState={detailLoadState}
          onBack={onBack}
        />
      ) : (
        isReady && <ClusterListView communities={communities} modularity={modularity} onSelect={onSelect} />
      )}
    </aside>
  )
}

export default CommunitiesPanel

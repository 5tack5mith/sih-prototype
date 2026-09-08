import TraceSetupSection from './TraceSetupSection'
import PathDetailSection from './PathDetailSection'
import './PathExplorerPanel.css'

function PathExplorerPanel({
  loadState,
  errorMessage,
  personOptions,
  fromId,
  toId,
  onChangeFrom,
  onChangeTo,
  onTrace,
  onReturn,
  pathLoadState,
  pathResult,
  pathErrorMessage,
  fromName,
  toName,
  onRetry,
}) {
  const isLoading = loadState === 'loading'
  const isError = loadState === 'error'
  const isNotFound = loadState === 'not-found'
  const isNoCase = loadState === 'no-case'
  const isReady = loadState === 'ready'

  return (
    <aside className="pep-panel">
      <div className="pep-panel__scroll">
        {isNoCase && <div className="pep-panel__state">RETURN TO CASES TO SELECT A CASE</div>}

        {isLoading && <div className="pep-panel__state">LOADING PATH EXPLORER…</div>}

        {isNotFound && <div className="pep-panel__state pep-panel__state--error">CASE NOT FOUND</div>}

        {isError && (
          <div className="pep-panel__state pep-panel__state--error">
            <p className="pep-panel__state-title">UNABLE TO LOAD PATH EXPLORER</p>
            <p className="pep-panel__state-detail">{errorMessage}</p>
            <button type="button" className="pep-panel__state-retry" onClick={onRetry}>
              RETRY
            </button>
          </div>
        )}

        {isReady && (
          <>
            <TraceSetupSection
              personOptions={personOptions}
              fromId={fromId}
              toId={toId}
              onChangeFrom={onChangeFrom}
              onChangeTo={onChangeTo}
              onTrace={onTrace}
              isTracing={pathLoadState === 'loading'}
            />

            {pathLoadState !== 'idle' && (
              <PathDetailSection
                pathLoadState={pathLoadState}
                pathResult={pathResult}
                pathErrorMessage={pathErrorMessage}
                fromName={fromName}
                toName={toName}
                onReturn={onReturn}
              />
            )}
          </>
        )}
      </div>

      <div className="pep-panel__footer">
        <div className="pep-panel__footer-row">
          <button type="button" className="pep-panel__btn pep-panel__btn--ghost">
            <span aria-hidden="true">▤</span> EXPORT PATH DOSSIER
          </button>
          <button type="button" className="pep-panel__btn pep-panel__btn--danger">
            <span aria-hidden="true">⚑</span> ADD TO SUBPOENA
          </button>
        </div>
      </div>
    </aside>
  )
}

export default PathExplorerPanel

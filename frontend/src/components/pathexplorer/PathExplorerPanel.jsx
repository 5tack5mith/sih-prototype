import { useState } from 'react'
import TraceSetupSection from './TraceSetupSection'
import PathDetailSection from './PathDetailSection'
import './PathExplorerPanel.css'

function PathExplorerPanel() {
  const [showDetail, setShowDetail] = useState(false)

  return (
    <aside className="pep-panel">
      <div className="pep-panel__scroll">
        <TraceSetupSection onTrace={() => setShowDetail(true)} />

        {showDetail && <PathDetailSection onReturn={() => setShowDetail(false)} />}
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
        <button type="button" className="pep-panel__btn-primary">
          <span aria-hidden="true">✦</span> ISOLATE PATH SUBGRAPH
        </button>
      </div>
    </aside>
  )
}

export default PathExplorerPanel

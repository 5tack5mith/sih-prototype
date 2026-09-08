import { useEffect, useMemo, useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import CaseOverviewPanel from '../components/overview/CaseOverviewPanel'
import OverviewNetworkGraph from '../components/overview/OverviewNetworkGraph'
import { fetchCaseOverview, fetchCaseGraph } from '../api/overviewApi'
import { scoreOf } from '../components/overview/graphLayout'
import './Overview.css'

const TOP_PLAYER_COUNT = 5

function Overview({ caseId, onBack, onNavigate }) {
  const [loadState, setLoadState] = useState(caseId ? 'loading' : 'no-case')
  const [overview, setOverview] = useState(null)
  const [graph, setGraph] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (!caseId) {
      setLoadState('no-case')
      return
    }

    let cancelled = false

    async function load() {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const [overviewResult, graphResult] = await Promise.all([
          fetchCaseOverview(caseId),
          fetchCaseGraph(caseId),
        ])
        if (cancelled) return

        if (overviewResult === null) {
          setLoadState('not-found')
          return
        }

        setOverview(overviewResult)
        setGraph(graphResult)
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err.message || 'Failed to load case data')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caseId, retryToken])

  const topPlayers = useMemo(() => {
    const nodes = graph?.nodes ?? []
    return [...nodes].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, TOP_PLAYER_COUNT)
  }, [graph])

  const targetValue = topPlayers[0]?.name || topPlayers[0]?.node_id

  const handleRetry = () => setRetryToken((t) => t + 1)

  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel={caseId || 'No case selected'} />
      <div className="overview-page__body">
        <Sidebar active="overview" onNavigate={onNavigate} />
        <GraphViewport
          docket={caseId || '—'}
          {...(targetValue ? { targetValue } : {})}
          backgroundImage={null}
        >
          <OverviewNetworkGraph
            loadState={loadState}
            errorMessage={errorMessage}
            graph={graph}
            onRetry={handleRetry}
          />
        </GraphViewport>
        <CaseOverviewPanel
          caseId={caseId}
          loadState={loadState}
          errorMessage={errorMessage}
          overview={overview}
          topPlayers={topPlayers}
          onRetry={handleRetry}
        />
      </div>
    </div>
  )
}

export default Overview

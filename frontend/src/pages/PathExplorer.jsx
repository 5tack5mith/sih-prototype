import { useEffect, useMemo, useRef, useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import OverviewNetworkGraph from '../components/overview/OverviewNetworkGraph'
import PathExplorerPanel from '../components/pathexplorer/PathExplorerPanel'
import { fetchCaseOverview, fetchCaseGraph, fetchPath } from '../api/overviewApi'
import './Overview.css'

function PathExplorer({ caseId, onBack, onNavigate, cases, onSelectCase }) {
  const [loadState, setLoadState] = useState(caseId ? 'loading' : 'no-case')
  const [graph, setGraph] = useState(null)
  const [overview, setOverview] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  const [fromId, setFromId] = useState(null)
  const [toId, setToId] = useState(null)
  const [pathLoadState, setPathLoadState] = useState('idle')
  const [pathResult, setPathResult] = useState(null)
  const [pathErrorMessage, setPathErrorMessage] = useState(null)

  const controlsRef = useRef(null)

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
        setErrorMessage(err.message || 'Failed to load path explorer data')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caseId, retryToken])

  const personOptions = useMemo(() => {
    const nodes = graph?.nodes ?? []
    return [...nodes]
      .map((n) => ({ node_id: String(n.node_id), name: n.name || String(n.node_id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [graph])

  const clearPath = () => {
    setPathResult(null)
    setPathLoadState('idle')
    setPathErrorMessage(null)
    controlsRef.current?.clearPathHighlight()
  }

  const handleChangeFrom = (nodeId) => {
    setFromId(nodeId)
    clearPath()
  }

  const handleChangeTo = (nodeId) => {
    setToId(nodeId)
    clearPath()
  }

  const handleTrace = async () => {
    if (!caseId || !fromId || !toId || fromId === toId) return
    setPathLoadState('loading')
    setPathErrorMessage(null)
    try {
      const result = await fetchPath(caseId, fromId, toId)
      setPathResult(result)
      if (result.path_found) {
        setPathLoadState('found')
        controlsRef.current?.highlightPath(result.nodes)
      } else {
        setPathLoadState('no-path')
        controlsRef.current?.clearPathHighlight()
      }
    } catch (err) {
      setPathErrorMessage(err.message || 'Failed to trace path')
      setPathLoadState('error')
      controlsRef.current?.clearPathHighlight()
    }
  }

  const handleReturn = () => clearPath()

  const handleRetry = () => setRetryToken((t) => t + 1)

  const fromName = personOptions.find((p) => p.node_id === fromId)?.name || fromId
  const toName = personOptions.find((p) => p.node_id === toId)?.name || toId

  // Sidebar badge counts, derived from data this page already loaded — no
  // extra requests just to populate the nav.
  const communityCount = overview?.community_count ?? undefined
  const keyPlayerCount = graph ? Math.min(10, graph.nodes.length) : undefined

  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel={caseId || 'No case selected'} cases={cases} onSelectCase={onSelectCase} />
      <div className="overview-page__body">
        <Sidebar
          active="path-explorer"
          onNavigate={onNavigate}
          communityCount={communityCount}
          keyPlayerCount={keyPlayerCount}
          metrics={graph?.metrics}
        />
        <GraphViewport
          docket={caseId || '—'}
          targetLabel="TARGET ENTITY"
          {...(toName ? { targetValue: toName } : {})}
          extraTelemetry={[
            { label: 'RESOLUTION', value: '1:1 NATIVE' },
            { label: 'PHYSICS', value: 'FORCE-ATLAS2 (DAMPED)' },
            { label: 'RENDER', value: 'WEBGL HARDWARE' },
          ]}
          backgroundImage={null}
          onZoomIn={loadState === 'ready' ? () => controlsRef.current?.zoomIn() : undefined}
          onZoomOut={loadState === 'ready' ? () => controlsRef.current?.zoomOut() : undefined}
          onFit={loadState === 'ready' ? () => controlsRef.current?.fit() : undefined}
        >
          <OverviewNetworkGraph
            loadState={loadState}
            errorMessage={errorMessage}
            graph={graph}
            registerControls={(api) => {
              controlsRef.current = api
            }}
            onRetry={handleRetry}
          />
        </GraphViewport>
        <PathExplorerPanel
          loadState={loadState}
          errorMessage={errorMessage}
          personOptions={personOptions}
          fromId={fromId}
          toId={toId}
          onChangeFrom={handleChangeFrom}
          onChangeTo={handleChangeTo}
          onTrace={handleTrace}
          onReturn={handleReturn}
          pathLoadState={pathLoadState}
          pathResult={pathResult}
          pathErrorMessage={pathErrorMessage}
          fromName={fromName}
          toName={toName}
          onRetry={handleRetry}
        />
      </div>
    </div>
  )
}

export default PathExplorer

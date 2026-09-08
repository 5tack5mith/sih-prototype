import { useEffect, useRef, useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import OverviewNetworkGraph from '../components/overview/OverviewNetworkGraph'
import PlayersPanel from '../components/keyplayers/PlayersPanel'
import { fetchCaseOverview, fetchCaseGraph, fetchTopNodes, fetchNodeDetail } from '../api/overviewApi'
import './Overview.css'

function KeyPlayers({ caseId, onBack, onNavigate, cases, onSelectCase }) {
  const [loadState, setLoadState] = useState(caseId ? 'loading' : 'no-case')
  const [overview, setOverview] = useState(null)
  const [graph, setGraph] = useState(null)
  const [players, setPlayers] = useState([])
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)
  const [sortMetric, setSortMetric] = useState('betweenness')

  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [nodeDetail, setNodeDetail] = useState(null)
  const [detailLoadState, setDetailLoadState] = useState('idle')

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
        const [overviewResult, graphResult, topNodesResult] = await Promise.all([
          fetchCaseOverview(caseId),
          fetchCaseGraph(caseId),
          fetchTopNodes(caseId, { metric: sortMetric }),
        ])
        if (cancelled) return

        if (overviewResult === null) {
          setLoadState('not-found')
          return
        }

        setOverview(overviewResult)
        setGraph(graphResult)
        setPlayers(topNodesResult.results ?? [])
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err.message || 'Failed to load key players data')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caseId, retryToken, sortMetric])

  // A fresh ranking (new case, or a different sort metric) resets which
  // person is selected — this is a new list, not an update to the old one.
  useEffect(() => {
    setSelectedNodeId(players[0]?.node_id ?? null)
  }, [players])

  useEffect(() => {
    if (!caseId || !selectedNodeId) {
      setNodeDetail(null)
      setDetailLoadState('idle')
      return
    }

    let cancelled = false

    async function loadDetail() {
      setDetailLoadState('loading')
      try {
        const result = await fetchNodeDetail(caseId, selectedNodeId)
        if (cancelled) return
        setNodeDetail(result)
        setDetailLoadState(result ? 'ready' : 'not-found')
      } catch {
        if (cancelled) return
        setDetailLoadState('error')
      }
    }

    loadDetail()
    return () => {
      cancelled = true
    }
  }, [caseId, selectedNodeId])

  const handleRetry = () => setRetryToken((t) => t + 1)

  // Graph highlighting only happens on an explicit click — the dossier
  // defaults to the #1 ranked player, but the graph itself stays unhighlighted
  // until the user actually clicks a row (or a node in the graph directly).
  const handleSelectPerson = (nodeId) => {
    setSelectedNodeId(nodeId)
    controlsRef.current?.selectNodeById(nodeId)
  }

  const handleHoverPerson = (nodeId) => controlsRef.current?.hoverNodeById(nodeId)
  const handleHoverEnd = () => controlsRef.current?.hoverNodeById(null)

  // Direct interaction with the graph itself (tapping a node, or tapping
  // empty space to clear) stays in sync with the ranking list/dossier.
  const handleGraphNodeSelect = (nodeId) => setSelectedNodeId(nodeId)

  const topPerson = players[0]

  // Sidebar badge counts, derived from data this page already loaded — no
  // extra requests just to populate the nav.
  const communityCount = overview?.community_count ?? undefined
  const keyPlayerCount = loadState === 'ready' ? players.length : undefined

  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel={caseId || 'No case selected'} cases={cases} onSelectCase={onSelectCase} />
      <div className="overview-page__body">
        <Sidebar
          active="key-players"
          onNavigate={onNavigate}
          communityCount={communityCount}
          keyPlayerCount={keyPlayerCount}
          metrics={graph?.metrics}
        />
        <GraphViewport
          title="VIEWPORT: KEY PLAYER CENTRALITY MAP"
          docket={caseId || '—'}
          targetLabel="TOP NODE"
          {...(topPerson ? { targetValue: topPerson.name || topPerson.node_id } : {})}
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
            onNodeSelect={handleGraphNodeSelect}
          />
        </GraphViewport>
        <PlayersPanel
          loadState={loadState}
          errorMessage={errorMessage}
          players={players}
          sortMetric={sortMetric}
          onChangeSortMetric={setSortMetric}
          selectedNodeId={selectedNodeId}
          onSelectPerson={handleSelectPerson}
          onHoverPerson={handleHoverPerson}
          onHoverEnd={handleHoverEnd}
          nodeDetail={nodeDetail}
          detailLoadState={detailLoadState}
          onRetry={handleRetry}
        />
      </div>
    </div>
  )
}

export default KeyPlayers

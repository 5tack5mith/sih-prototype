import { useEffect, useMemo, useRef, useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import OverviewNetworkGraph from '../components/overview/OverviewNetworkGraph'
import CommunitiesPanel from '../components/communities/CommunitiesPanel'
import CommunityGraphBar from '../components/communities/CommunityGraphBar'
import { fetchCaseOverview, fetchCaseGraph, fetchCommunities, fetchCommunityDetail } from '../api/overviewApi'
import './Overview.css'

function Communities({ caseId, onBack, onNavigate, cases, onSelectCase }) {
  const [loadState, setLoadState] = useState(caseId ? 'loading' : 'no-case')
  const [graph, setGraph] = useState(null)
  const [communities, setCommunities] = useState([])
  const [modularity, setModularity] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
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
        const [overviewResult, graphResult, communitiesResult] = await Promise.all([
          fetchCaseOverview(caseId),
          fetchCaseGraph(caseId),
          fetchCommunities(caseId),
        ])
        if (cancelled) return

        if (overviewResult === null) {
          setLoadState('not-found')
          return
        }

        setGraph(graphResult)
        setCommunities(communitiesResult ?? [])
        setModularity(overviewResult.modularity ?? null)
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err.message || 'Failed to load communities data')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caseId, retryToken])

  useEffect(() => {
    setSelectedId(null)
  }, [caseId, retryToken])

  useEffect(() => {
    if (!caseId || !selectedId) {
      setDetail(null)
      setDetailLoadState('idle')
      return
    }

    let cancelled = false

    async function loadDetail() {
      setDetailLoadState('loading')
      try {
        const result = await fetchCommunityDetail(caseId, selectedId)
        if (cancelled) return
        setDetail(result)
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
  }, [caseId, selectedId])

  // Focused mode filters both nodes AND edges down to the selected
  // community's own members — non-member nodes/cross-community edges are
  // removed from the graph entirely, not dimmed.
  const displayedGraph = useMemo(() => {
    if (!selectedId || !detail || !graph) return graph
    const memberIds = new Set(detail.members.map((m) => String(m.node_id)))
    return {
      nodes: graph.nodes.filter((n) => memberIds.has(String(n.node_id))),
      edges: graph.edges.filter((e) => memberIds.has(String(e.source)) && memberIds.has(String(e.target))),
    }
  }, [graph, selectedId, detail])

  // Re-fit whenever the actually-displayed graph changes — entering a
  // community, switching to a different one, or clearing back to the full
  // case graph should always automatically recenter.
  useEffect(() => {
    controlsRef.current?.fit()
  }, [displayedGraph])

  const handleRetry = () => setRetryToken((t) => t + 1)
  const handleSelect = (communityId) => setSelectedId(communityId)
  const handleBack = () => setSelectedId(null)

  const selectedSummary = communities.find((c) => c.community_id === selectedId) || null

  // Sidebar badge counts, derived from data this page already loaded — no
  // extra requests just to populate the nav.
  const communityCount = loadState === 'ready' ? communities.length : undefined
  const keyPlayerCount = graph ? Math.min(10, graph.nodes.length) : undefined

  return (
    <div className="overview-page">
      <CaseHeader onBack={onBack} caseLabel={caseId || 'No case selected'} cases={cases} onSelectCase={onSelectCase} />
      <div className="overview-page__body">
        <Sidebar
          active="communities"
          onNavigate={onNavigate}
          communityCount={communityCount}
          keyPlayerCount={keyPlayerCount}
          metrics={graph?.metrics}
        />
        <GraphViewport
          docket={caseId || '—'}
          targetLabel="ACTIVE VIEW"
          targetValue={selectedSummary ? selectedSummary.label : 'FULL CASE GRAPH'}
          extraTelemetry={[
            { label: 'RESOLUTION', value: '1:1 NATIVE' },
            { label: 'PHYSICS', value: 'FORCE-ATLAS2 (DAMPED)' },
            { label: 'RENDER', value: 'WEBGL HARDWARE' },
          ]}
          backgroundImage={null}
          subBar={
            selectedId ? (
              <CommunityGraphBar summary={selectedSummary} detail={detail} onBack={handleBack} />
            ) : null
          }
          onZoomIn={loadState === 'ready' ? () => controlsRef.current?.zoomIn() : undefined}
          onZoomOut={loadState === 'ready' ? () => controlsRef.current?.zoomOut() : undefined}
          onFit={loadState === 'ready' ? () => controlsRef.current?.fit() : undefined}
        >
          <OverviewNetworkGraph
            loadState={loadState}
            errorMessage={errorMessage}
            graph={displayedGraph}
            showIsolates={Boolean(selectedId)}
            registerControls={(api) => {
              controlsRef.current = api
            }}
            onRetry={handleRetry}
          />
        </GraphViewport>
        <CommunitiesPanel
          loadState={loadState}
          errorMessage={errorMessage}
          communities={communities}
          modularity={modularity}
          selectedId={selectedId}
          detail={detail}
          detailLoadState={detailLoadState}
          onSelect={handleSelect}
          onBack={handleBack}
          onRetry={handleRetry}
        />
      </div>
    </div>
  )
}

export default Communities

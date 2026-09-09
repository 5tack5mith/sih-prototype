import { useEffect, useMemo, useRef, useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import OverviewNetworkGraph from '../components/overview/OverviewNetworkGraph'
import CommunitiesPanel from '../components/communities/CommunitiesPanel'
import CommunityGraphBar from '../components/communities/CommunityGraphBar'
import { fetchCaseOverview, fetchCaseGraph, fetchCommunities, fetchCommunityDetail } from '../api/overviewApi'
import { computeDegrees } from '../components/overview/graphLayout'
import './Overview.css'

const CUTOFF_VALUE = 0.75

function Communities({ caseId, onBack, onNavigate, cases, onSelectCase }) {
  const [loadState, setLoadState] = useState(caseId ? 'loading' : 'no-case')
  const [graph, setGraph] = useState(null)
  const [communities, setCommunities] = useState([])
  const [modularity, setModularity] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  // Subset filters — same semantics as Overview: bridgingOnly/cutoffEnabled
  // re-fetch the graph against the API's real filter/cutoff params;
  // isolatesVisible is a pure client-side render filter.
  const [bridgingOnly, setBridgingOnly] = useState(false)
  const [cutoffEnabled, setCutoffEnabled] = useState(false)
  const [isolatesVisible, setIsolatesVisible] = useState(false)

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
          fetchCaseGraph(caseId, {
            filter: bridgingOnly ? 'bridging_only' : undefined,
            cutoff: cutoffEnabled ? CUTOFF_VALUE : undefined,
          }),
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
    // bridgingOnly/cutoffEnabled intentionally re-trigger a fetch: they're
    // real API query params, unlike isolatesVisible which is client-only.
  }, [caseId, retryToken, bridgingOnly, cutoffEnabled])

  useEffect(() => {
    setSelectedId(null)
  }, [caseId, retryToken])

  const isolateCount = useMemo(() => {
    const nodes = graph?.nodes ?? []
    const edges = graph?.edges ?? []
    const degrees = computeDegrees(nodes, edges)
    return nodes.filter((n) => (degrees.get(String(n.node_id)) ?? 0) === 0).length
  }, [graph])

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

  // Search-selecting a person here has no in-page place to show them — hand
  // off to Key Players, same as every other page's search-driven selection.
  const handleSelectPerson = (nodeId) => {
    if (nodeId) onNavigate?.('key-players', { selectedNodeId: nodeId })
  }

  const rankedCommunities = useMemo(
    () =>
      communities.map((community, index) => ({
        ...community,
        displayRank: index + 1,
        label: `Cluster ${index + 1}`,
      })),
    [communities]
  )

  const selectedSummary = rankedCommunities.find((c) => c.community_id === selectedId) || null

  // Sidebar badge counts, derived from data this page already loaded — no
  // extra requests just to populate the nav.
  const communityCount = loadState === 'ready' ? rankedCommunities.length : undefined
  const keyPlayerCount = graph ? Math.min(10, graph.nodes.length) : undefined

  return (
    <div className="overview-page">
      <CaseHeader
        onBack={onBack}
        caseLabel={caseId || 'No case selected'}
        cases={cases}
        onSelectCase={onSelectCase}
        personNodes={graph?.nodes}
        onSelectPerson={handleSelectPerson}
      />
      <div className="overview-page__body">
        <Sidebar
          active="communities"
          onNavigate={onNavigate}
          isolatesVisible={isolatesVisible}
          isolateCount={isolateCount}
          onToggleIsolates={caseId ? () => setIsolatesVisible((v) => !v) : undefined}
          bridgingOnly={bridgingOnly}
          onToggleBridging={caseId ? () => setBridgingOnly((v) => !v) : undefined}
          cutoffEnabled={cutoffEnabled}
          onToggleCutoff={caseId ? () => setCutoffEnabled((v) => !v) : undefined}
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
            showIsolates={Boolean(selectedId) || isolatesVisible}
            registerControls={(api) => {
              controlsRef.current = api
            }}
            onRetry={handleRetry}
          />
        </GraphViewport>
        <CommunitiesPanel
          caseId={caseId}
          loadState={loadState}
          errorMessage={errorMessage}
          communities={rankedCommunities}
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

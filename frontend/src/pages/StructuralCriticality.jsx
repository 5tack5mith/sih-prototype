import { useEffect, useMemo, useRef, useState } from 'react'
import CaseHeader from '../components/overview/CaseHeader'
import Sidebar from '../components/overview/Sidebar'
import GraphViewport from '../components/overview/GraphViewport'
import OverviewNetworkGraph from '../components/overview/OverviewNetworkGraph'
import CriticalityToolbar from '../components/criticality/CriticalityToolbar'
import CriticalityPanel from '../components/criticality/CriticalityPanel'
import { fetchCaseOverview, fetchCaseGraph, fetchCriticality } from '../api/overviewApi'
import { computeDegrees } from '../components/overview/graphLayout'
import './Overview.css'
import './StructuralCriticality.css'

const CUTOFF_VALUE = 0.75

function StructuralCriticality({ caseId, onBack, onNavigate, cases, onSelectCase }) {
  const [loadState, setLoadState] = useState(caseId ? 'loading' : 'no-case')
  const [graph, setGraph] = useState(null)
  const [overview, setOverview] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  // Subset filters — same semantics as Overview: bridgingOnly/cutoffEnabled
  // re-fetch the graph against the API's real filter/cutoff params;
  // isolatesVisible is a pure client-side render filter.
  const [bridgingOnly, setBridgingOnly] = useState(false)
  const [cutoffEnabled, setCutoffEnabled] = useState(false)
  const [isolatesVisible, setIsolatesVisible] = useState(false)

  const [topK, setTopK] = useState(6)
  const [criticality, setCriticality] = useState(null)
  const [criticalityLoadState, setCriticalityLoadState] = useState('loading')
  const [criticalityErrorMessage, setCriticalityErrorMessage] = useState(null)

  const [selectedNodeId, setSelectedNodeId] = useState(null)

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
          fetchCaseGraph(caseId, {
            filter: bridgingOnly ? 'bridging_only' : undefined,
            cutoff: cutoffEnabled ? CUTOFF_VALUE : undefined,
          }),
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
        setErrorMessage(err.message || 'Failed to load structural criticality data')
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

  const isolateCount = useMemo(() => {
    const nodes = graph?.nodes ?? []
    const edges = graph?.edges ?? []
    const degrees = computeDegrees(nodes, edges)
    return nodes.filter((n) => (degrees.get(String(n.node_id)) ?? 0) === 0).length
  }, [graph])

  useEffect(() => {
    if (!caseId || loadState !== 'ready') return undefined

    let cancelled = false

    async function loadCriticality() {
      setCriticalityLoadState('loading')
      setCriticalityErrorMessage(null)
      try {
        const result = await fetchCriticality(caseId, topK)
        if (cancelled) return
        setCriticality(result)
        setCriticalityLoadState(result.ranked_removals?.length ? 'ready' : 'empty')
      } catch (err) {
        if (cancelled) return
        setCriticalityErrorMessage(err.message || 'Failed to load criticality data')
        setCriticalityLoadState('error')
      }
    }

    loadCriticality()
    return () => {
      cancelled = true
    }
  }, [caseId, retryToken, topK, loadState])

  // A fresh ranking (new case, or a different top-K) resets which person is
  // selected — this is a new list, not an update to the old one.
  useEffect(() => {
    setSelectedNodeId(criticality?.ranked_removals?.[0]?.node_id ?? null)
  }, [criticality])

  const handleRetry = () => setRetryToken((t) => t + 1)

  // Graph highlighting only happens on an explicit click — the panel
  // defaults to showing rank #1, but the graph itself stays unhighlighted
  // until the user actually clicks a row (matching Key Players' behavior).
  const handleSelectPerson = (nodeId) => {
    setSelectedNodeId(nodeId)
    controlsRef.current?.selectNodeById(nodeId)
  }

  // Search-selecting a person here has no in-page place to show them — hand
  // off to Key Players, same as every other page's search-driven selection.
  const handleSearchSelectPerson = (nodeId) => {
    if (nodeId) onNavigate?.('key-players', { selectedNodeId: nodeId })
  }

  const topEntity = criticality?.ranked_removals?.[0]

  return (
    <div className="overview-page crit-page">
      <CaseHeader
        onBack={onBack}
        caseLabel={caseId || 'No case selected'}
        cases={cases}
        onSelectCase={onSelectCase}
        personNodes={graph?.nodes}
        onSelectPerson={handleSearchSelectPerson}
      />
      <div className="overview-page__body">
        <Sidebar
          active="structural-criticality"
          onNavigate={onNavigate}
          isolatesVisible={isolatesVisible}
          isolateCount={isolateCount}
          onToggleIsolates={caseId ? () => setIsolatesVisible((v) => !v) : undefined}
          bridgingOnly={bridgingOnly}
          onToggleBridging={caseId ? () => setBridgingOnly((v) => !v) : undefined}
          cutoffEnabled={cutoffEnabled}
          onToggleCutoff={caseId ? () => setCutoffEnabled((v) => !v) : undefined}
          communityCount={overview?.community_count ?? undefined}
          keyPlayerCount={graph ? Math.min(10, graph.nodes.length) : undefined}
          metrics={graph?.metrics}
        />
        <GraphViewport
          title="VIEWPORT: STRUCTURAL RESILIENCE ENGINE"
          docket={caseId || '—'}
          targetLabel="TARGET ENTITY"
          {...(topEntity ? { targetValue: topEntity.node_name || topEntity.node_id } : {})}
          extraTelemetry={[
            { label: 'RESOLUTION', value: '1:1 NATIVE' },
            { label: 'PHYSICS', value: 'FORCE-ATLAS2 (DAMPED)' },
            { label: 'RENDER', value: 'WEBGL HARDWARE' },
          ]}
          backgroundImage={null}
          subBar={
            <CriticalityToolbar
              topK={topK}
              onChangeTopK={setTopK}
              criticality={criticality}
              criticalityLoadState={criticalityLoadState}
              onRefresh={handleRetry}
            />
          }
          onZoomIn={loadState === 'ready' ? () => controlsRef.current?.zoomIn() : undefined}
          onZoomOut={loadState === 'ready' ? () => controlsRef.current?.zoomOut() : undefined}
          onFit={loadState === 'ready' ? () => controlsRef.current?.fit() : undefined}
        >
          <OverviewNetworkGraph
            loadState={loadState}
            errorMessage={errorMessage}
            graph={graph}
            showIsolates={isolatesVisible}
            registerControls={(api) => {
              controlsRef.current = api
            }}
            onRetry={handleRetry}
            onNodeSelect={setSelectedNodeId}
          />
        </GraphViewport>
        <CriticalityPanel
          caseId={caseId}
          loadState={loadState}
          errorMessage={errorMessage}
          topK={topK}
          criticality={criticality}
          criticalityLoadState={criticalityLoadState}
          criticalityErrorMessage={criticalityErrorMessage}
          selectedNodeId={selectedNodeId}
          onSelectPerson={handleSelectPerson}
          onRetry={handleRetry}
        />
      </div>
    </div>
  )
}

export default StructuralCriticality

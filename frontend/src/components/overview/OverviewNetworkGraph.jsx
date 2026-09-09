import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import { computeGraphLayout, computeDegrees, scoreOf } from './graphLayout'
import './OverviewNetworkGraph.css'

const POSITION_SCALE = 8

// Stylesheet and layout are module-level constants so their references never
// change across renders — react-cytoscapejs only needs to touch the live cy
// instance when `elements` actually changes (new data), not on every
// hover/selection/play-state re-render.
const STYLESHEET = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      width: 'data(size)',
      height: 'data(size)',
      'overlay-opacity': 0,
      'border-width': 0,
      // Smooths every style-driven change (hub overlay, hover/selection
      // sizing, fade-in for newly added nodes) - position changes are
      // animated separately via cy node.animate(), which this doesn't cover.
      'transition-property': 'background-color, width, height, opacity, border-width, border-opacity',
      'transition-duration': 250,
      'transition-timing-function': 'ease-out',
    },
  },
  {
    selector: 'node[hub]',
    style: {
      'overlay-color': 'data(color)',
      'overlay-opacity': 0.16,
      'overlay-padding': 5,
    },
  },
  {
    selector: 'node[showLabel]',
    style: {
      label: 'data(label)',
      color: '#cbd5e1',
      'font-size': 7,
      'font-family': 'IBM Plex Mono, monospace',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 4,
      'text-background-color': '#0b0e14',
      'text-background-opacity': 0.7,
      'text-background-padding': 2,
      'text-background-shape': 'roundrectangle',
      'text-wrap': 'ellipsis',
      'text-max-width': 90,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 'data(width)',
      'line-color': '#a9b7c9',
      opacity: 'data(opacity)',
      'curve-style': 'haystack',
      'haystack-radius': 0,
      'target-arrow-shape': 'none',
      'transition-property': 'width, opacity, line-color',
      'transition-duration': 250,
      'transition-timing-function': 'ease-out',
    },
  },
  {
    selector: '.hovered',
    style: {
      width: 'data(hoverSize)',
      height: 'data(hoverSize)',
      'background-blacken': -0.25,
      'z-index': 999,
    },
  },
  {
    selector: 'edge.hovered',
    style: { 'line-color': '#c3ccd6', opacity: 0.6, 'z-index': 998 },
  },
  {
    selector: '.selected-node',
    style: {
      'border-width': 1.4,
      'border-color': '#e7ecf3',
      'border-opacity': 0.9,
      'z-index': 1000,
    },
  },
  {
    selector: 'edge.selected-edge',
    style: { 'line-color': '#e7ecf3', opacity: 0.85, width: 1.1, 'z-index': 999 },
  },
  {
    selector: '.dimmed',
    style: { opacity: 0.12 },
  },
]

const LAYOUT = { name: 'preset' }

// Shared by the internal tap handler and the imperative selectNodeById
// control exposed via registerControls (used by KeyPlayers to select a
// node from its ranking list) - one selection implementation, two callers.
function clearHighlight(cy) {
  cy.elements().removeClass('dimmed hovered selected-node selected-edge')
}

function applySelection(cy, node) {
  const neighborhood = node.closedNeighborhood()
  cy.elements().difference(neighborhood).addClass('dimmed')
  neighborhood.removeClass('dimmed')
  node.addClass('selected-node')
  node.connectedEdges().addClass('selected-edge')
}

// frozenPositions maps node id -> the position last actually fed to
// Cytoscape's declarative elements diff. For a node that already existed,
// this deliberately returns its OLD (unchanged) position rather than the
// freshly computed target - so react-cytoscapejs's own diff/patch sees no
// position change and never snaps it instantly. The real move to the new
// target is instead driven by the animate-to-target effect below, via
// cy node.animate(), which is the only thing capable of a smooth glide.
// A node with no frozen entry yet (brand new) gets its real target position
// immediately - there's no "old" position to jump from.
function buildElements(positioned, edges, frozenPositions) {
  const idSet = new Set(positioned.map((n) => String(n.node_id)))
  const scores = positioned.map(scoreOf)
  const maxScore = Math.max(...scores, 0.0001)
  const weights = edges.map((e) => e.weight ?? 1)
  const maxWeight = Math.max(...weights, 1)

  const labelCount = Math.min(12, Math.max(5, Math.ceil(positioned.length * 0.25)))
  const hubIds = new Set(
    [...positioned]
      .sort((a, b) => scoreOf(b) - scoreOf(a))
      .slice(0, labelCount)
      .map((n) => String(n.node_id))
  )

  const nodeElements = positioned.map((node) => {
    const idStr = String(node.node_id)
    const ratio = scoreOf(node) / maxScore
    const isHub = hubIds.has(idStr)
    // sqrt scaling keeps most nodes clustered near the low end (6-9px) while
    // only the highest-centrality handful reach the 12-15px hub range —
    // a raw linear ratio produced an unreadable 5px-vs-28px spread.
    const size = 6 + Math.sqrt(ratio) * 9
    const target = { x: node.x * POSITION_SCALE, y: node.y * POSITION_SCALE }
    return {
      data: {
        id: idStr,
        label: node.name || idStr,
        color: node.color,
        size,
        hoverSize: size * 1.15,
        ...(isHub ? { hub: 'true', showLabel: 'true' } : {}),
      },
      position: frozenPositions.get(idStr) ?? target,
    }
  })

  const edgeElements = edges
    .filter((e) => idSet.has(String(e.source)) && idSet.has(String(e.target)) && String(e.source) !== String(e.target))
    .map((edge, i) => {
      const weightRatio = (edge.weight ?? 1) / maxWeight
      return {
        data: {
          id: `e${i}:${edge.source}->${edge.target}`,
          source: String(edge.source),
          target: String(edge.target),
          width: 0.7 + weightRatio * 0.5,
          opacity: 0.32 + weightRatio * 0.28,
        },
      }
    })

  return [...nodeElements, ...edgeElements]
}

function OverviewNetworkGraph({
  loadState,
  errorMessage,
  graph,
  showIsolates,
  registerControls,
  onRetry,
  onNodeSelect,
}) {
  const cyRef = useRef(null)
  const [cyReady, setCyReady] = useState(null)

  // Keeps the last graph actually rendered so a filter-triggered or
  // navigation-triggered refetch (loadState briefly back to 'loading') can
  // keep showing it instead of tearing the whole graph down to a blank
  // "LOADING…" placeholder - that full unmount/remount (Cytoscape included)
  // was the real source of the jump: a fresh Cytoscape instance every time,
  // with no continuity to animate from. Only a true first load (nothing
  // shown yet) or a hard error/no-case/not-found state should replace it.
  const lastGraphRef = useRef(null)
  const hasShownGraph = lastGraphRef.current !== null
  if (graph) lastGraphRef.current = graph
  if (loadState === 'no-case' || loadState === 'not-found') lastGraphRef.current = null
  const effectiveGraph = graph ?? (loadState === 'loading' ? lastGraphRef.current : null)
  const isRefreshing = loadState === 'loading' && hasShownGraph

  // Frozen positions fed to Cytoscape's declarative elements diff - see
  // buildElements' comment. Persists across renders (not state) since
  // updating it must never itself trigger a re-render.
  const frozenPositionsRef = useRef(new Map())

  const nodes = effectiveGraph?.nodes ?? []
  const edges = effectiveGraph?.edges ?? []

  const degrees = useMemo(() => computeDegrees(nodes, edges), [nodes, edges])

  const visibleNodes = useMemo(() => {
    if (showIsolates) return nodes
    return nodes.filter((node) => (degrees.get(String(node.node_id)) ?? 0) > 0)
  }, [nodes, degrees, showIsolates])

  // Expensive (force simulation) — only recompute when the graph data or
  // isolate visibility actually changes, never on hover/selection/play state.
  const positioned = useMemo(() => computeGraphLayout(visibleNodes, edges), [visibleNodes, edges])

  const elements = useMemo(
    () => buildElements(positioned, edges, frozenPositionsRef.current),
    [positioned, edges]
  )

  const handleCy = useCallback((cy) => {
    if (cyRef.current === cy) return
    cyRef.current = cy
    cy.fit(undefined, 40)
    setCyReady(cy)
  }, [])

  // Runs after Cytoscape has committed `elements` (still at each node's
  // frozen/old position) but before the browser paints, so a brand-new
  // node's fade-in starts from invisible with no flashed frame, and an
  // existing node's glide to its real target starts from where it visibly
  // already was - the only way to get an actual "from A to B" animation
  // instead of an instant relocation.
  useLayoutEffect(() => {
    const cy = cyReady
    if (!cy) return

    const frozen = frozenPositionsRef.current
    const currentIds = new Set()

    positioned.forEach((node) => {
      const idStr = String(node.node_id)
      currentIds.add(idStr)
      const target = { x: node.x * POSITION_SCALE, y: node.y * POSITION_SCALE }
      const ele = cy.getElementById(idStr)
      if (ele.empty()) return

      if (!frozen.has(idStr)) {
        ele.style('opacity', 0)
        ele.animate({ style: { opacity: 1 } }, { duration: 300, easing: 'ease-out' })
      } else {
        const current = ele.position()
        if (Math.abs(current.x - target.x) > 0.05 || Math.abs(current.y - target.y) > 0.05) {
          ele.stop(true)
          ele.animate({ position: target }, { duration: 450, easing: 'ease-out-cubic' })
        }
      }
      frozen.set(idStr, target)
    })

    // Drop entries for nodes no longer present so a later re-add is treated
    // as new (fades in) rather than reusing a stale frozen position.
    for (const id of frozen.keys()) {
      if (!currentIds.has(id)) frozen.delete(id)
    }
  }, [positioned, cyReady])

  // Hover / click-to-highlight, bound imperatively so it never touches the
  // `elements` prop (and therefore never triggers a layout re-application).
  // Depends on `cyReady` (state, not the plain ref) so this actually runs
  // once the cytoscape instance exists — react-cytoscapejs invokes the `cy`
  // callback after this component's own mount-time effects would otherwise
  // have already run and bailed out on a null ref.
  useEffect(() => {
    const cy = cyReady
    if (!cy) return undefined

    const onNodeTap = (evt) => {
      clearHighlight(cy)
      applySelection(cy, evt.target)
      onNodeSelect?.(evt.target.id())
    }
    const onBackgroundTap = (evt) => {
      if (evt.target === cy) {
        clearHighlight(cy)
        onNodeSelect?.(null)
      }
    }
    const onMouseOver = (evt) => {
      evt.target.addClass('hovered')
      evt.target.connectedEdges().addClass('hovered')
    }
    const onMouseOut = (evt) => {
      evt.target.removeClass('hovered')
      evt.target.connectedEdges().removeClass('hovered')
    }
    const onDblTapBackground = (evt) => {
      if (evt.target === cy) cy.animate({ fit: { eles: cy.elements(), padding: 40 } }, { duration: 300 })
    }

    cy.on('tap', 'node', onNodeTap)
    cy.on('tap', onBackgroundTap)
    cy.on('mouseover', 'node', onMouseOver)
    cy.on('mouseout', 'node', onMouseOut)
    cy.on('dbltap', onDblTapBackground)

    return () => {
      cy.removeListener('tap', 'node', onNodeTap)
      cy.removeListener('tap', onBackgroundTap)
      cy.removeListener('mouseover', 'node', onMouseOver)
      cy.removeListener('mouseout', 'node', onMouseOut)
      cy.removeListener('dbltap', onDblTapBackground)
    }
  }, [cyReady, onNodeSelect])

  // Expose zoom/fit/selection to the GraphViewport's +/-/fit buttons and,
  // for pages that pass registerControls (Overview, Key Players), to
  // external UI wanting to drive the graph imperatively — e.g. Key Players'
  // ranking list selecting/hovering the corresponding node. Overview never
  // calls selectNodeById/hoverNodeById/clearSelection, so this is purely
  // additive and does not change Overview's behavior.
  useEffect(() => {
    if (!registerControls) return undefined
    registerControls({
      zoomIn: () => {
        const cy = cyRef.current
        if (!cy) return
        cy.animate({ zoom: { level: cy.zoom() * 1.3, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 150 })
      },
      zoomOut: () => {
        const cy = cyRef.current
        if (!cy) return
        cy.animate({ zoom: { level: cy.zoom() * 0.75, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: 150 })
      },
      // Fits to the just-computed TARGET layout (positioned), not
      // cy.elements()'s live bounding box - nodes are still gliding toward
      // that target via the animate-to-target effect above when a caller
      // (e.g. Communities re-fitting right after picking a cluster) invokes
      // this, so the live box is a mid-flight snapshot that can be tiny or
      // off to one side, landing the camera on empty space or one node.
      fit: () => {
        const cy = cyRef.current
        if (!cy || positioned.length === 0) return
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
        positioned.forEach((node) => {
          const x = node.x * POSITION_SCALE
          const y = node.y * POSITION_SCALE
          if (x < x1) x1 = x
          if (x > x2) x2 = x
          if (y < y1) y1 = y
          if (y > y2) y2 = y
        })
        cy.animate({ fit: { boundingBox: { x1, y1, x2, y2 }, padding: 40 } }, { duration: 300 })
      },
      selectNodeById: (nodeId) => {
        const cy = cyRef.current
        if (!cy || nodeId === null || nodeId === undefined) return
        const node = cy.getElementById(String(nodeId))
        if (node.empty()) return
        clearHighlight(cy)
        applySelection(cy, node)
        cy.animate({ center: { eles: node } }, { duration: 200 })
      },
      clearSelection: () => {
        const cy = cyRef.current
        if (cy) clearHighlight(cy)
      },
      hoverNodeById: (nodeId) => {
        const cy = cyRef.current
        if (!cy) return
        cy.elements().removeClass('hovered')
        if (nodeId === null || nodeId === undefined) return
        const node = cy.getElementById(String(nodeId))
        if (node.empty()) return
        node.addClass('hovered')
        node.connectedEdges().addClass('hovered')
      },
      // Path Explorer: highlight exactly the traced path (nodes + only the
      // edges directly connecting consecutive path nodes), dimming
      // everything else without removing it from the graph. Reuses the same
      // selected-node/selected-edge/dimmed classes as click-to-select.
      highlightPath: (pathNodeIds) => {
        const cy = cyRef.current
        if (!cy || !pathNodeIds || pathNodeIds.length === 0) return
        const ids = pathNodeIds.map(String)
        const pathNodes = cy.collection()
        ids.forEach((id) => {
          pathNodes.merge(cy.getElementById(id))
        })
        const consecutivePairs = new Set()
        for (let i = 0; i < ids.length - 1; i += 1) {
          consecutivePairs.add(`${ids[i]}->${ids[i + 1]}`)
          consecutivePairs.add(`${ids[i + 1]}->${ids[i]}`)
        }
        const pathEdges = cy.edges().filter((edge) =>
          consecutivePairs.has(`${edge.source().id()}->${edge.target().id()}`)
        )
        const highlighted = pathNodes.union(pathEdges)
        if (highlighted.empty()) return
        clearHighlight(cy)
        cy.elements().difference(highlighted).addClass('dimmed')
        pathNodes.addClass('selected-node')
        pathEdges.addClass('selected-edge')
        cy.animate({ fit: { eles: highlighted, padding: 60 } }, { duration: 300 })
      },
      clearPathHighlight: () => {
        const cy = cyRef.current
        if (cy) clearHighlight(cy)
      },
    })
    return () => registerControls(null)
  }, [registerControls, positioned])

  if (loadState === 'no-case') {
    return <div className="ovng-state">SELECT A CASE TO VIEW ITS NETWORK GRAPH</div>
  }

  // A 'loading' state with nothing shown yet (true first load, or the graph
  // just got cleared by a case switch) is the only time this blanks the
  // view - once something has rendered, a 'loading' caused by a filter or
  // background refetch keeps showing it (effectiveGraph/isRefreshing above)
  // instead of tearing the whole Cytoscape instance down.
  if (loadState === 'loading' && !hasShownGraph) {
    return <div className="ovng-state">LOADING NETWORK GRAPH…</div>
  }

  if (loadState === 'not-found') {
    return <div className="ovng-state ovng-state--error">CASE NOT FOUND</div>
  }

  if (loadState === 'error') {
    return (
      <div className="ovng-state ovng-state--error">
        <p className="ovng-state__title">UNABLE TO LOAD NETWORK GRAPH</p>
        <p className="ovng-state__detail">{errorMessage}</p>
        <button type="button" className="ovng-state__retry" onClick={onRetry}>
          RETRY
        </button>
      </div>
    )
  }

  if (nodes.length === 0) {
    return <div className="ovng-state">NO GRAPH DATA AVAILABLE FOR THIS CASE</div>
  }

  return (
    <div className="ovng">
      <CytoscapeComponent
        elements={elements}
        style={{ width: '100%', height: '100%' }}
        stylesheet={STYLESHEET}
        layout={LAYOUT}
        cy={handleCy}
        minZoom={0.15}
        maxZoom={6}
        wheelSensitivity={0.25}
        boxSelectionEnabled={false}
      />
      {isRefreshing && <div className="ovng-syncing">SYNCING…</div>}
    </div>
  )
}

export default OverviewNetworkGraph

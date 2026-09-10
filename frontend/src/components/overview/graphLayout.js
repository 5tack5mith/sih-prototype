// Deterministic force-directed layout for GET /cases/{id}/graph nodes.
// The API returns no coordinates. This module:
//   1. Groups nodes by community_id into zones spaced evenly around the canvas.
//   2. Seeds each node's initial position inside its zone using a proper
//      avalanching hash (a naive polynomial hash collapses near-identical for
//      sequential ids like "P000", "P001", ... — verified and fixed here).
//   3. Exposes a reusable spring/repulsion simulation: `computeGraphLayout`
//      runs it to convergence once (deterministic initial layout — no
//      Math.random anywhere), and `createForceSimulation` exposes the same
//      physics as a steppable object so a UI can drive a live, pausable
//      simulation without duplicating the force math.

export const COMMUNITY_COLORS = ['#38bdf8', '#c084fc', '#4ade80', '#fbbf24', '#f472b6', '#a78bfa', '#f97316', '#22d3ee']

// Base community-zone centering pull used for well-connected nodes
// (degree >= 2) - unchanged from the original single-coefficient design.
const BASE_CENTERING = 0.02
// Upper bound on the boosted pull for low-degree nodes, so an isolated
// node drifts toward the main mass without being yanked hard enough to
// overshoot into a dense unreadable blob at dead center.
const MAX_CENTERING = 0.2

// Degree-dependent centering coefficient: degree 0 (no edges at all - the
// case that produces the straight boundary-hugging rows) gets 10x the base
// pull, degree 1 gets 5x, degree >= 2 is exactly the original 0.02 with no
// change at all. Scales inversely with degree, capped at MAX_CENTERING.
//
// Tuned empirically, not guessed: at realistic case proportions (roughly
// as many zero-degree Person/Phone nodes as connected Account nodes - see
// dataset_generator/README.md), the isolated nodes' dominant force is
// mutual repulsion AMONG THEMSELVES, not just repulsion from the connected
// cluster. That means centering alone has a real ceiling - pushing this
// coefficient far past 10x (tested up to 40x) only moved a further ~5% of
// isolated nodes off the clamp boundary, while visibly dragging
// well-connected node positions along with it. 10x is the chosen balance:
// a measurable pull inward for every isolated node (they end up closer to
// the mass and less uniformly pinned to one exact boundary line even when
// they don't fully leave it) without material disturbance to the
// well-connected structure. This will not eliminate every straight-edge
// row on cases with very high noise-node proportions - see the report for
// exact before/after numbers.
function centeringCoefficientFor(degree) {
  if (degree >= 2) return BASE_CENTERING
  return Math.min(BASE_CENTERING * (10 / (degree + 1)), MAX_CENTERING)
}

// FNV-1a with an avalanche finalizer — small input changes (e.g. "P000" vs
// "P001") must produce very different outputs, which a naive `h*31+c` hash
// does not for sequential/near-identical strings.
function goodHash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function seededUnit(seed) {
  return goodHash(seed) / 4294967296
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// Maps a community_id to one of COMMUNITY_COLORS by the id's own intrinsic
// value (numeric community ids parse directly; anything else falls back to
// the same avalanche hash used for position seeding) rather than by its
// position among whatever community ids happen to be present in the current
// node set. This is what lets the Communities page filter the graph down to
// a single selected community and have it keep the exact color it had in
// the full graph — a position-based index would always collapse a lone
// remaining community to palette slot 0.
export function communityColor(communityId) {
  const key = communityId ?? '_ungrouped'
  const numeric = Number(key)
  const idx = Number.isFinite(numeric) ? numeric : goodHash(String(key))
  return COMMUNITY_COLORS[((idx % COMMUNITY_COLORS.length) + COMMUNITY_COLORS.length) % COMMUNITY_COLORS.length]
}

export function scoreOf(node) {
  return node.betweenness ?? node.degree ?? node.eigenvector ?? 0
}

export function computeDegrees(nodes, edges) {
  const degree = new Map(nodes.map((n) => [String(n.node_id), 0]))
  edges.forEach((edge) => {
    const source = String(edge.source)
    const target = String(edge.target)
    if (degree.has(source)) degree.set(source, degree.get(source) + 1)
    if (degree.has(target)) degree.set(target, degree.get(target) + 1)
  })
  return degree
}

/**
 * Builds a reusable, steppable force simulation for a graph.
 * Returns { positions, step, colorFor } where `positions` is a
 * Map<nodeId, {x,y,vx,vy}> (0-100 coordinate space) mutated in place by
 * `step(temperature)`. Deterministic: identical input always produces
 * identical initial positions and identical results from repeated `step()`
 * calls given the same starting positions.
 */
export function createForceSimulation(nodes, edges = []) {
  const communityIds = [...new Set(nodes.map((n) => n.community_id ?? '_ungrouped'))]
  const zoneCenters = new Map()

  if (communityIds.length <= 1) {
    zoneCenters.set(communityIds[0], { x: 50, y: 50 })
  } else {
    const zoneRadius = 30
    communityIds.forEach((id, i) => {
      const angle = (i / communityIds.length) * Math.PI * 2 - Math.PI / 2
      zoneCenters.set(id, {
        x: 50 + Math.cos(angle) * zoneRadius,
        y: 50 + Math.sin(angle) * zoneRadius * 0.85,
      })
    })
  }

  const positions = new Map()
  nodes.forEach((node) => {
    const key = node.community_id ?? '_ungrouped'
    const center = zoneCenters.get(key)
    const seed = String(node.node_id)
    const jitterAngle = seededUnit(`${seed}:a`) * Math.PI * 2
    const jitterRadius = 4 + seededUnit(`${seed}:b`) * 16
    positions.set(seed, {
      x: center.x + Math.cos(jitterAngle) * jitterRadius,
      y: center.y + Math.sin(jitterAngle) * jitterRadius,
      vx: 0,
      vy: 0,
    })
  })

  const ids = nodes.map((n) => String(n.node_id))
  const idSet = new Set(ids)
  const edgeList = edges
    .map((e) => ({ source: String(e.source), target: String(e.target) }))
    .filter((e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target)

  // Degree within this exact rendered view (same edgeList the spring force
  // below uses) - drives the degree-dependent centering pull a few lines
  // down. A node with no edge-spring force pulling it inward has nothing
  // to counteract repulsion, so it gets pushed to the clamp boundary and
  // piles up in a straight row with every other such node (see BASE_
  // CENTERING below for the fix).
  const layoutDegree = new Map(ids.map((id) => [id, 0]))
  edgeList.forEach(({ source, target }) => {
    layoutDegree.set(source, layoutDegree.get(source) + 1)
    layoutDegree.set(target, layoutDegree.get(target) + 1)
  })

  const n = ids.length
  // Standard Fruchterman-Reingold ideal-distance formula (k = sqrt(area/n)):
  // correct for graphs sized anywhere near this 90x90 canvas, but for a
  // small filtered subset (e.g. Communities viewing a single 4-5 node
  // cluster) it blows up - sqrt(8100/4)*0.9 = ~40, a repulsion radius
  // nearly half the canvas, which flings the few nodes straight out to the
  // position clamp's edges instead of letting them settle near their zone
  // center. Capping it keeps larger graphs (where it's already below the
  // cap) untouched while keeping small clusters visually tight - this is
  // what "click a cluster" zooming into a random node or empty space
  // traced back to: the fit itself was correct, framing an actually
  // scattered layout.
  const rawK = Math.sqrt((90 * 90) / Math.max(n, 1)) * 0.9
  const k = Math.min(rawK, 24)
  const communityOf = new Map(nodes.map((node) => [String(node.node_id), node.community_id ?? '_ungrouped']))

  function step(temperature = 3) {
    for (let i = 0; i < n; i += 1) {
      const a = positions.get(ids[i])
      let dx = 0
      let dy = 0
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue
        const b = positions.get(ids[j])
        let ddx = a.x - b.x
        let ddy = a.y - b.y
        let dist2 = ddx * ddx + ddy * ddy
        if (dist2 < 0.02) {
          ddx = (seededUnit(`${ids[i]}|${ids[j]}`) - 0.5) * 0.2
          ddy = (seededUnit(`${ids[j]}|${ids[i]}`) - 0.5) * 0.2
          dist2 = 0.02
        }
        const dist = Math.sqrt(dist2)
        const force = (k * k) / dist
        dx += (ddx / dist) * force
        dy += (ddy / dist) * force
      }
      a.vx = dx
      a.vy = dy
    }

    edgeList.forEach(({ source, target }) => {
      const a = positions.get(source)
      const b = positions.get(target)
      const dx = a.x - b.x
      const dy = a.y - b.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
      const force = (dist * dist) / k
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx -= fx
      a.vy -= fy
      b.vx += fx
      b.vy += fy
    })

    nodes.forEach((node) => {
      const idStr = String(node.node_id)
      const pos = positions.get(idStr)
      const center = zoneCenters.get(communityOf.get(idStr))
      const centering = centeringCoefficientFor(layoutDegree.get(idStr) ?? 0)
      pos.vx += (center.x - pos.x) * centering
      pos.vy += (center.y - pos.y) * centering

      const dispLen = Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy) || 0.0001
      const capped = Math.min(dispLen, temperature)
      pos.x = clamp(pos.x + (pos.vx / dispLen) * capped, 5, 95)
      pos.y = clamp(pos.y + (pos.vy / dispLen) * capped, 7, 91)
    })
  }

  function colorFor(node) {
    return communityColor(node.community_id)
  }

  return { positions, step, colorFor, communityIds, skipPhysics: n > 400 }
}

/** One-shot deterministic layout for the initial render (cooling schedule). */
export function computeGraphLayout(nodes, edges = []) {
  if (nodes.length === 0) return []

  const sim = createForceSimulation(nodes, edges)
  if (!sim.skipPhysics) {
    const iterations = nodes.length > 150 ? 90 : 220
    let temperature = 10
    for (let iter = 0; iter < iterations; iter += 1) {
      sim.step(temperature)
      temperature *= 0.97
    }
  }

  return nodes.map((node) => {
    const pos = sim.positions.get(String(node.node_id))
    return { ...node, x: pos.x, y: pos.y, color: sim.colorFor(node) }
  })
}

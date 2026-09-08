// Deterministic client-side layout for GET /cases/{id}/graph nodes.
// The API returns no coordinates, so nodes are grouped by community_id into
// up to 3 loose zones (matching the zone-label convention used elsewhere in
// the app) and spread within each zone using a stable hash of the node id —
// same input always produces the same position, no layout jitter on re-render.

const ZONE_CENTERS = [
  { x: 30, y: 34 },
  { x: 70, y: 30 },
  { x: 50, y: 74 },
]

const ZONE_COLORS = ['#38bdf8', '#c084fc', '#fbbf24']

function hashString(value) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function computeGraphLayout(nodes) {
  const groups = new Map()
  nodes.forEach((node) => {
    const key = node.community_id ?? '_ungrouped'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(node)
  })

  const groupKeys = [...groups.keys()]
  const positioned = []

  groupKeys.forEach((key, groupIndex) => {
    const center = ZONE_CENTERS[groupIndex % ZONE_CENTERS.length]
    const color = ZONE_COLORS[groupIndex % ZONE_COLORS.length]
    const members = groups.get(key)

    members.forEach((node, memberIndex) => {
      const hash = hashString(String(node.node_id))
      const angle = ((hash % 360) * Math.PI) / 180
      const ring = Math.floor(memberIndex / 8)
      const radius = 8 + ((hash >> 8) % 12) + ring * 11

      positioned.push({
        ...node,
        x: clamp(center.x + Math.cos(angle) * radius * 0.75, 6, 94),
        y: clamp(center.y + Math.sin(angle) * radius * 0.55, 8, 90),
        color,
        groupIndex,
      })
    })
  })

  return positioned
}

export function scoreOf(node) {
  return node.betweenness ?? node.degree ?? node.eigenvector ?? 0
}

export const TRACE = {
  algorithm: 'DIJKSTRA-BIAS',
  from: {
    name: 'Victor Chen (Nominee)',
    meta: 'ENT-0x104A · Individual Owner',
  },
  to: {
    name: 'Al-Miraj Forex Gateway',
    meta: 'ENT-0x982C · FinTech Gateway',
  },
  weighting: 'All Trans & Shell Layering',
  evidenceCount: 14,
}

export const PATH_DETAIL = {
  pathId: 'PTH-8891-NX',
  strength: '0.89',
  title: 'Victor Chen → Al-Miraj Forex',
  chainLabel: '2-HOP GEODESIC CHAIN',
  viaLabel: 'VIA VALKYRIE-HOLDINGS',
  stats: [
    { label: 'PATH LENGTH', value: '2', unit: 'Hops', sub: '1 INTERMEDIARY' },
    { label: 'THROUGHPUT', value: '$1.42M', sub: 'TOTAL VOLUME' },
    { label: 'LATENCY', value: '13d', sub: 'OCT 15 → OCT 28' },
  ],
  steps: [
    {
      index: 1,
      title: 'Nominee Control Link',
      statusTag: 'Observed',
      statusVariant: 'teal',
      from: 'Victor Chen',
      to: 'Valkyrie Holdings',
      detail: 'Filing: CY-8812 (Nicosia Reg)',
      right: '100% SHARES',
      rightVariant: 'gold',
    },
    {
      index: 2,
      title: 'Settlement Wire Routing',
      statusTag: 'Analysis',
      statusVariant: 'default',
      from: 'Valkyrie Holdings',
      to: 'Al-Miraj Forex',
      detail: '4 Wire Batches [TX-8821]',
      right: '$1,420,000 USD',
      rightVariant: 'plain',
    },
  ],
  evidence: [
    {
      time: '2024-10-28 14:22 UTC',
      accent: true,
      text: 'Final wire tranche: $1,420,000 USD dispatched from Valkyrie account to Al-Miraj clearing pool [TX-8821]',
    },
    {
      time: '2024-10-15 09:04 UTC',
      accent: false,
      text: 'Victor Chen registered as 100% nominal director and signing authority for Valkyrie Holdings Ltd',
    },
  ],
}

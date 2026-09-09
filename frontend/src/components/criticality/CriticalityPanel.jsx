import './CriticalityPanel.css'

function formatCriterion(criterion) {
  if (!criterion) return '—'
  return criterion.replace(/_/g, ' ').toUpperCase()
}

function fragmentationVariant(pct) {
  if (pct >= 50) return 'red'
  if (pct >= 20) return 'amber'
  return 'teal'
}

function safeFilenamePart(value) {
  return String(value ?? 'unknown').replace(/[^a-zA-Z0-9._-]+/g, '-')
}

function escapePdfText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapLine(text, maxChars) {
  const words = String(text).split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function buildRobustnessLines({ caseId, topK, criticality }) {
  const removals = criticality.ranked_removals ?? []
  const finalState = criticality.final_state
  const lines = [
    'NETRA ROBUSTNESS REPORT',
    `Case: ${caseId || '—'}`,
    `Generated: ${new Date().toISOString()}`,
    `Top-K cut: ${topK}`,
    `Initial component: ${criticality.initial_node_count} nodes`,
    `Removal criterion: ${formatCriterion(criticality.criterion)}`,
    '',
  ]

  if (finalState) {
    lines.push(
      'FINAL STATE',
      `Efficiency drop: ${finalState.overall_efficiency_drop_pct.toFixed(1)}%`,
      `Largest remaining component: ${finalState.largest_remaining_component} nodes`,
      `Components created: ${finalState.components_created ?? '—'}`,
      ''
    )
  }

  if (criticality.impact_narrative) {
    lines.push('IMPACT SYNTHESIS', ...wrapLine(criticality.impact_narrative, 88), '')
  }

  if (criticality.note) {
    lines.push('NOTE', ...wrapLine(criticality.note, 88), '')
  }

  lines.push('RANKED CHOKEPOINTS (BFR / AFT / FRG)')
  for (const removal of removals) {
    lines.push(
      `${String(removal.rank).padStart(2, '0')}. ${removal.node_name || removal.node_id}  [${removal.entity_type_label}]  ${removal.component_size_before} / ${removal.component_size_after} / ${removal.fragmentation_pct.toFixed(1)}%  id=${removal.node_id}`
    )
  }
  return lines
}

function buildSimplePdf(lines) {
  const lineHeight = 13
  const pageHeight = 792
  const margin = 50
  const maxLines = Math.max(1, Math.floor((pageHeight - margin * 2) / lineHeight))
  const pages = []
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines))
  if (pages.length === 0) pages.push([''])

  const objects = ['']
  const addObject = (body) => {
    objects.push(body)
    return objects.length - 1
  }

  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>')
  const pageIds = []
  const contentIds = []

  for (const pageLines of pages) {
    const commands = ['BT', '/F1 10 Tf', `${margin} ${pageHeight - margin} Td`, `${lineHeight} TL`]
    pageLines.forEach((line, index) => {
      const escaped = escapePdfText(line)
      commands.push(index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`)
    })
    commands.push('ET')
    const stream = commands.join('\n')
    contentIds.push(
      addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    )
  }

  const kids = []
  contentIds.forEach((contentId) => {
    const pageId = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    )
    pageIds.push(pageId)
    kids.push(`${pageId} 0 R`)
  })

  const pagesId = addObject(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageIds.length} >>`)
  for (const pageId of pageIds) {
    objects[pageId] = objects[pageId].replace('/Parent 0 0 R', `/Parent ${pagesId} 0 R`)
  }
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const fileOffsets = [0]
  for (let i = 1; i < objects.length; i += 1) {
    fileOffsets[i] = pdf.length
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let i = 1; i < objects.length; i += 1) {
    pdf += `${String(fileOffsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return pdf
}

function downloadPdf(filename, lines) {
  const blob = new Blob([buildSimplePdf(lines)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function CriticalityPanel({
  caseId,
  loadState,
  errorMessage,
  topK,
  criticality,
  criticalityLoadState,
  criticalityErrorMessage,
  selectedNodeId,
  onSelectPerson,
  onRetry,
}) {
  const isLoading = loadState === 'loading'
  const isError = loadState === 'error'
  const isNotFound = loadState === 'not-found'
  const isNoCase = loadState === 'no-case'
  const isReady = loadState === 'ready'

  const removals = criticality?.ranked_removals ?? []
  const finalState = criticality?.final_state

  return (
    <aside className="crit-panel">
      <div className="crit-panel__scroll">
        {isNoCase && <div className="crit-panel__state">RETURN TO CASES TO SELECT A CASE</div>}

        {isLoading && <div className="crit-panel__state">LOADING STRUCTURAL CRITICALITY…</div>}

        {isNotFound && <div className="crit-panel__state crit-panel__state--error">CASE NOT FOUND</div>}

        {isError && (
          <div className="crit-panel__state crit-panel__state--error">
            <p className="crit-panel__state-title">UNABLE TO LOAD STRUCTURAL CRITICALITY</p>
            <p className="crit-panel__state-detail">{errorMessage}</p>
            <button type="button" className="crit-panel__state-retry" onClick={onRetry}>
              RETRY
            </button>
          </div>
        )}

        {isReady && (
          <>
            <div className="crit-panel__header">
              <div className="crit-panel__header-row">
                <h2 className="crit-panel__title">STRUCTURAL CRITICALITY RANKING</h2>
                <span className="crit-panel__cut-tag">TOP-{topK} CUT</span>
              </div>
              <p className="crit-panel__subtitle">PERCOLATION &amp; ROBUSTNESS ANALYSIS</p>
            </div>

            {criticalityLoadState === 'loading' && (
              <div className="crit-panel__state">LOADING CRITICALITY RESULTS…</div>
            )}

            {criticalityLoadState === 'error' && (
              <div className="crit-panel__state crit-panel__state--error">
                <p className="crit-panel__state-title">UNABLE TO LOAD CRITICALITY RESULTS</p>
                <p className="crit-panel__state-detail">{criticalityErrorMessage}</p>
                <button type="button" className="crit-panel__state-retry" onClick={onRetry}>
                  RETRY
                </button>
              </div>
            )}

            {criticalityLoadState === 'empty' && (
              <div className="crit-panel__state">NO CRITICALITY RESULTS PRECOMPUTED FOR THIS CASE</div>
            )}

            {criticalityLoadState === 'ready' && criticality && (
              <>
                <div className="crit-panel__stats">
                  <div className="crit-stat">
                    <span className="crit-stat__label">INITIAL COMPONENT</span>
                    <span className="crit-stat__value">{criticality.initial_node_count} NODES</span>
                  </div>
                  <div className="crit-stat">
                    <span className="crit-stat__label">REMOVAL CRITERION</span>
                    <span className="crit-stat__value crit-stat__value--gold">
                      {formatCriterion(criticality.criterion)}
                    </span>
                    <span className="crit-stat__sub">GREEDY SEQUENTIAL REMOVAL</span>
                  </div>
                  {finalState && (
                    <>
                      <div className="crit-stat crit-stat--alert">
                        <span className="crit-stat__label">EFFICIENCY DROP</span>
                        <span className="crit-stat__value crit-stat__value--red">
                          {finalState.overall_efficiency_drop_pct.toFixed(1)}%
                        </span>
                        <span className="crit-stat__sub">AFTER TOP-{topK} REMOVAL</span>
                      </div>
                      <div className="crit-stat">
                        <span className="crit-stat__label">SECONDARY COMP.</span>
                        <span className="crit-stat__value crit-stat__value--teal">
                          {finalState.largest_remaining_component} NODES
                        </span>
                        <span className="crit-stat__sub">LARGEST REMAINING SUBGRAPH</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="crit-panel__chokepoints">
                  <div className="crit-panel__section-row">
                    <span className="crit-panel__section-title">RANKED CHOKEPOINTS</span>
                    <span className="crit-panel__step-sequence">REMOVAL SEQUENCE</span>
                  </div>

                  <div className="crit-table">
                    <div className="crit-table__head">
                      <span className="crit-table__col-rank">#</span>
                      <span className="crit-table__col-entity">CHOKEPOINT ENTITY</span>
                      <span className="crit-table__col-num">BFR</span>
                      <span className="crit-table__col-num">AFT</span>
                      <span className="crit-table__col-frg">FRG</span>
                    </div>

                    {removals.map((removal) => {
                      const isSelected = removal.node_id === selectedNodeId
                      return (
                        <div
                          className={`crit-row${isSelected ? ' crit-row--highlight' : ''}`}
                          key={removal.node_id}
                          onClick={() => onSelectPerson(removal.node_id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(evt) => {
                            if (evt.key === 'Enter' || evt.key === ' ') onSelectPerson(removal.node_id)
                          }}
                        >
                          <span className="crit-row__rank">{String(removal.rank).padStart(2, '0')}</span>
                          <span className="crit-row__entity">
                            <span className="crit-row__name">{removal.node_name || removal.node_id}</span>
                            <span
                              className={`crit-row__sub crit-row__sub--${
                                removal.entity_type_label === 'CRITICAL CUT' ? 'red' : 'default'
                              }`}
                            >
                              {removal.entity_type_label}
                            </span>
                          </span>
                          <span className="crit-row__num">{removal.component_size_before}</span>
                          <span className="crit-row__num">{removal.component_size_after}</span>
                          <span
                            className={`crit-row__frg crit-row__frg--${fragmentationVariant(removal.fragmentation_pct)}`}
                          >
                            {removal.fragmentation_pct.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {criticality.note && <p className="crit-panel__note">{criticality.note}</p>}
                </div>

                {criticality.impact_narrative && (
                  <div className="crit-panel__impact">
                    <div className="crit-panel__section-row">
                      <span className="crit-panel__impact-title">IMPACT SYNTHESIS</span>
                    </div>
                    <p className="crit-panel__impact-text">{criticality.impact_narrative}</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {isReady && criticalityLoadState === 'ready' && removals.length > 0 && (
        <div className="crit-panel__footer">
          <button type="button" className="crit-panel__btn" onClick={() => onSelectPerson(removals[0].node_id)}>
            <span aria-hidden="true">◎</span> Select Most Critical Person
          </button>
          <button
            type="button"
            className="crit-panel__btn"
            onClick={() => {
              const lines = buildRobustnessLines({ caseId, topK, criticality })
              const filename = `${safeFilenamePart(caseId)}-robustness-report-top${topK}.pdf`
              downloadPdf(filename, lines)
            }}
          >
            <span aria-hidden="true">⭳</span> Export Robustness Report (PDF)
          </button>
        </div>
      )}
    </aside>
  )
}

export default CriticalityPanel

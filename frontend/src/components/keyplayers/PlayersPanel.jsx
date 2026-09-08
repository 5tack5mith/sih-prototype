import downloadIcon from '../../assets/keyplayers/download-icon.svg'
import './PlayersPanel.css'

const PLAYERS = [
  { rank: 1, name: 'Valkyrie Holdings Ltd', tag: 'ENTITY', tagVariant: 'default', score: '0.942', barPct: 94, top: true },
  { rank: 2, name: 'Al-Miraj Forex Gateway', tag: 'GATEWAY', tagVariant: 'blue', score: '0.887', barPct: 89 },
  { rank: 3, name: 'Kestrel Escrow AG', tag: 'ESCROW', tagVariant: 'amber', score: '0.814', barPct: 81 },
  { rank: 4, name: 'Victor Chen (Nominee)', tag: 'INDIVIDUAL', tagVariant: 'default', score: '0.765', barPct: 76 },
  { rank: 5, name: 'Apex Settlement Pool 4', tag: 'POOL', tagVariant: 'amber', score: '0.720', barPct: 72 },
  { rank: 6, name: 'Helios Transponder Relay', tag: 'GATEWAY', tagVariant: 'blue', score: '0.689', barPct: 69 },
  { rank: 7, name: 'Maritime Prime Trust', tag: 'ENTITY', tagVariant: 'default', score: '0.641', barPct: 64 },
  { rank: 8, name: 'Boreas Logistics BV', tag: 'ENTITY', tagVariant: 'default', score: '0.598', barPct: 60 },
  { rank: 9, name: 'Mikhail Sarkis', tag: 'INDIVIDUAL', tagVariant: 'default', score: '0.543', barPct: 54 },
  { rank: 10, name: 'CipherKey Relay Node 07', tag: 'GATEWAY', tagVariant: 'blue', score: '0.492', barPct: 49 },
]

const SORT_TABS = [
  { key: 'betweenness', label: 'Betweenness', active: true },
  { key: 'eigen', label: 'Eigen' },
  { key: 'degree', label: 'Degree' },
]

function formatRank(rank) {
  return `#${String(rank).padStart(2, '0')}`
}

function PlayersPanel() {
  return (
    <aside className="kp-panel">
      <div className="kp-panel__header">
        <div className="kp-panel__header-top">
          <div className="kp-panel__title-row">
            <h2 className="kp-panel__title">Key Players</h2>
            <span className="kp-panel__top10-tag">TOP 10</span>
          </div>
          <button type="button" className="kp-panel__download">
            <img src={downloadIcon} alt="Export" />
          </button>
        </div>
        <div className="kp-panel__sort-row">
          <span className="kp-panel__ranked-by">RANKED BY CENTRALITY ↓</span>
          <div className="kp-panel__sort-tabs">
            {SORT_TABS.map((tab, index) => (
              <span key={tab.key} className="kp-panel__sort-tab-group">
                {index > 0 && <span className="kp-panel__sort-sep">|</span>}
                <span className={`kp-panel__sort-tab${tab.active ? ' kp-panel__sort-tab--active' : ''}`}>
                  {tab.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="kp-panel__scroll">
        {PLAYERS.map((player) => (
          <div
            key={player.rank}
            className={`kp-row${player.top ? ' kp-row--top' : ''}`}
          >
            <div className="kp-row__top">
              <span className="kp-row__name">
                <span className={`kp-row__rank${player.top ? ' kp-row__rank--top' : ''}`}>
                  {formatRank(player.rank)}
                </span>
                <span className={`kp-row__name-text${player.top ? ' kp-row__name-text--top' : ''}`}>
                  {player.name}
                </span>
              </span>
              <span className="kp-row__right">
                <span className={`kp-row__tag kp-row__tag--${player.tagVariant}`}>{player.tag}</span>
                <span className="kp-row__score">{player.score}</span>
              </span>
            </div>
            <div className="kp-row__bar-track">
              <span
                className={`kp-row__bar-fill${player.top ? ' kp-row__bar-fill--top' : ''}`}
                style={{ width: `${player.barPct}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="kp-panel__dossier">
        <div className="kp-dossier__header">
          <span className="kp-dossier__name">
            <span className="kp-dossier__icon" aria-hidden="true">
              ◆
            </span>
            Valkyrie Holdings Ltd
          </span>
          <span className="kp-dossier__tag">TOP CENTRALITY</span>
        </div>
        <div className="kp-dossier__stats">
          <div className="kp-dossier__stat">
            <span className="kp-dossier__stat-value">48</span>
            <span className="kp-dossier__stat-label">DEGREE</span>
          </div>
          <div className="kp-dossier__stat">
            <span className="kp-dossier__stat-value kp-dossier__stat-value--gold">0.942</span>
            <span className="kp-dossier__stat-label">BETWEENNESS</span>
          </div>
          <div className="kp-dossier__stat">
            <span className="kp-dossier__stat-value">0.891</span>
            <span className="kp-dossier__stat-label">EIGENVECTOR</span>
          </div>
        </div>
        <button type="button" className="kp-dossier__btn">
          VIEW FULL ENTITY LEDGER →
        </button>
      </div>
    </aside>
  )
}

export default PlayersPanel

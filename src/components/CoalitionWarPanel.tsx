import { useState } from 'react'
import { useWorldStore } from '../store/worldStore'
import { useGameStore } from '../store/gameStore'
import '../styles/CoalitionWarPanel.css'

/**
 * CoalitionWarPanel - Shows Article 5 coalition wars in a dedicated sidebar panel
 * Displays: coalition name, defender/aggressor, allied forces, countries attacking
 * Supports collapse/expand for managing multiple conflicts
 */
export function CoalitionWarPanel() {
    const { activeCoalitionWars, aiCountries, coalitions } = useWorldStore()
    const playerNation = useGameStore(s => s.nation)
    const [expandedWars, setExpandedWars] = useState<Set<string>>(new Set())

    // Only show ACTIVE coalition wars - hide ended ones
    const activeWars = activeCoalitionWars.filter(w => w.status === 'active')

    if (activeWars.length === 0) return null

    const toggleExpand = (warId: string) => {
        setExpandedWars(prev => {
            const newSet = new Set(prev)
            if (newSet.has(warId)) {
                newSet.delete(warId)
            } else {
                newSet.add(warId)
            }
            return newSet
        })
    }

    return (
        <div className="coalition-war-panel">
            {activeWars.map(war => {
                const coalition = coalitions.find(c => c.id === war.coalitionId)
                const aggressor = aiCountries.get(war.aggressorCode)
                const defender = war.defenderCode === 'PLAYER'
                    ? playerNation
                    : aiCountries.get(war.defenderCode)

                const defenderName = war.defenderCode === 'PLAYER'
                    ? playerNation?.name || 'Your Nation'
                    : defender?.name || war.defenderCode

                const aggressorName = aggressor?.name || war.aggressorCode
                const isExpanded = expandedWars.has(war.id)

                return (
                    <div key={war.id} className={`coalition-war-card ${isExpanded ? 'expanded' : 'collapsed'}`}>
                        {/* Header - Always visible, clickable to expand */}
                        <div
                            className="coalition-war-header"
                            onClick={() => toggleExpand(war.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="coalition-icon">{coalition?.icon || '🛡️'}</span>
                            <div className="coalition-war-title">
                                <span className="article-5-badge">ARTICLE 5</span>
                                <h3>{war.coalitionName}</h3>
                            </div>
                            <span className="collapse-indicator">{isExpanded ? '▼' : '▶'}</span>
                        </div>

                        {/* Collapsible Content */}
                        {isExpanded && (
                            <>
                                {/* Parties */}
                                <div className="coalition-war-parties">
                                    <div className="war-party defender">
                                        <span className="party-label">Defender</span>
                                        <span className="party-name">{defenderName}</span>
                                    </div>
                                    <span className="vs-badge">VS</span>
                                    <div className="war-party aggressor">
                                        <span className="party-label">Aggressor</span>
                                        <span className="party-name">{aggressorName}</span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="coalition-war-stats">
                                    <div className="stat-row">
                                        <span className="stat-label">⚔️ Allied Forces</span>
                                        <span className="stat-value">{war.totalAlliedSoldiers.toLocaleString()}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">🏛️ Nations at War</span>
                                        <span className="stat-value">{war.alliesAtWar.length}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">📉 Aggressor Territory Lost</span>
                                        <span className="stat-value">{war.aggressorTerritoryLost.toFixed(1)}%</span>
                                    </div>
                                </div>

                                {/* Active Attackers */}
                                {war.alliesAttacking.length > 0 && (
                                    <div className="coalition-attackers">
                                        <span className="attackers-label">🗡️ Actively Attacking:</span>
                                        <div className="attacker-list">
                                            {war.alliesAttacking.map(code => {
                                                const ally = aiCountries.get(code)
                                                return (
                                                    <span key={code} className="attacker-badge">
                                                        {ally?.name || code}
                                                    </span>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* War Status */}
                                <div className={`coalition-war-status status-${war.status}`}>
                                    {war.status === 'active' && '🔥 War in Progress'}
                                    {war.status === 'victory' && '🏆 Coalition Victory'}
                                    {war.status === 'defeat' && '💀 Coalition Defeat'}
                                    {war.status === 'peace' && '🕊️ Peace Signed'}
                                </div>
                            </>
                        )}

                        {/* Collapsed Summary */}
                        {!isExpanded && (
                            <div className="collapsed-summary">
                                <span>{defenderName} vs {aggressorName}</span>
                                <span className="collapsed-status">• {war.alliesAtWar.length} nations</span>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

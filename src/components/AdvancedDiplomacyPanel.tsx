/**
 * Advanced Diplomacy Panel
 * 
 * Unified panel for all advanced diplomacy features:
 * - United Nations resolutions and voting
 * - Diplomatic crises management
 * - Soft power and influence actions
 * - Summit proposals
 */

import React, { useState, useEffect } from 'react'
import { useWorldStore } from '../store/worldStore'
import type { UNResolution, DiplomaticCrisis, InfluenceActionType, SummitTopic } from '../types/diplomaticTypes'

type TabType = 'UN' | 'CRISES' | 'INFLUENCE' | 'SUMMIT'

const TAB_ICONS: Record<TabType, string> = {
    UN: '🏛️',
    CRISES: '⚠️',
    INFLUENCE: '🌟',
    SUMMIT: '🤝'
}

export const AdvancedDiplomacyPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('UN')
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

    const {
        unitedNations,
        activeCrises,
        softPowerState,
        activeSummit,
        diplomacyMessages,
        aiCountries,
        initializeDiplomacy,
        voteOnResolution,
        respondToCrisis,
        executeInfluenceAction,
        proposeSummit,
        clearDiplomacyMessages
    } = useWorldStore()

    // Initialize diplomacy systems on mount
    useEffect(() => {
        if (!unitedNations || !softPowerState) {
            initializeDiplomacy()
        }
    }, [unitedNations, softPowerState, initializeDiplomacy])

    // Get list of available countries for influence
    const availableCountries = Array.from(aiCountries.values())
        .filter(c => !c.isAnnexed)
        .sort((a, b) => b.relations - a.relations)

    return (
        <div className="advanced-diplomacy-panel">
            <div className="diplomacy-header">
                <h2>🌐 Advanced Diplomacy</h2>
                {softPowerState && (
                    <div className="influence-display">
                        <span className="influence-points">
                            🌟 {softPowerState.influencePoints} Influence
                        </span>
                        <span className="influence-income">
                            (+{softPowerState.monthlyInfluenceIncome}/mo)
                        </span>
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="diplomacy-tabs">
                {(Object.keys(TAB_ICONS) as TabType[]).map(tab => (
                    <button
                        key={tab}
                        className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {TAB_ICONS[tab]} {tab}
                        {tab === 'CRISES' && activeCrises.length > 0 && (
                            <span className="badge">{activeCrises.length}</span>
                        )}
                        {tab === 'UN' && unitedNations?.activeResolutions && unitedNations.activeResolutions.length > 0 && (
                            <span className="badge">{unitedNations.activeResolutions.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'UN' && (
                    <UNTab
                        unitedNations={unitedNations}
                        onVote={voteOnResolution}
                    />
                )}

                {activeTab === 'CRISES' && (
                    <CrisisTab
                        crises={activeCrises}
                        onRespond={respondToCrisis}
                    />
                )}

                {activeTab === 'INFLUENCE' && (
                    <InfluenceTab
                        softPowerState={softPowerState}
                        countries={availableCountries}
                        selectedCountry={selectedCountry}
                        onSelectCountry={setSelectedCountry}
                        onExecuteAction={executeInfluenceAction}
                    />
                )}

                {activeTab === 'SUMMIT' && (
                    <SummitTab
                        activeSummit={activeSummit}
                        countries={availableCountries}
                        onPropose={proposeSummit}
                    />
                )}
            </div>

            {/* Message Log */}
            {diplomacyMessages.length > 0 && (
                <div className="diplomacy-messages">
                    <div className="messages-header">
                        <span>Recent Events</span>
                        <button onClick={clearDiplomacyMessages}>Clear</button>
                    </div>
                    <div className="messages-list">
                        {diplomacyMessages.slice(-5).map((msg, i) => (
                            <div key={i} className="message">{msg}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// === UN TAB ===
interface UNTabProps {
    unitedNations: any
    onVote: (resolutionId: string, vote: 'YES' | 'NO' | 'ABSTAIN') => void
}

const UNTab: React.FC<UNTabProps> = ({ unitedNations, onVote }) => {
    if (!unitedNations) {
        return <div className="empty-state">United Nations initializing...</div>
    }

    const { activeResolutions, passedResolutions, securityCouncil } = unitedNations

    return (
        <div className="un-tab">
            <div className="security-council">
                <h4>Security Council</h4>
                <div className="council-members">
                    <span className="p5">P5: {securityCouncil.permanentMembers.join(', ')}</span>
                </div>
            </div>

            <h4>Active Resolutions ({activeResolutions.length})</h4>
            {activeResolutions.length === 0 ? (
                <div className="empty-state">No resolutions pending</div>
            ) : (
                <div className="resolutions-list">
                    {activeResolutions.map((res: UNResolution) => (
                        <div key={res.id} className="resolution-card">
                            <div className="resolution-header">
                                <span className="type-badge">{res.type.replace(/_/g, ' ')}</span>
                                {res.requiresSecurityCouncil && <span className="sc-badge">SC</span>}
                            </div>
                            <h5>{res.title}</h5>
                            <p>{res.description}</p>
                            <div className="vote-status">
                                Threshold: {(res.passThreshold * 100).toFixed(0)}%
                            </div>
                            <div className="vote-buttons">
                                <button
                                    className="vote-yes"
                                    onClick={() => onVote(res.id, 'YES')}
                                >
                                    ✓ Yes
                                </button>
                                <button
                                    className="vote-no"
                                    onClick={() => onVote(res.id, 'NO')}
                                >
                                    ✗ No
                                </button>
                                <button
                                    className="vote-abstain"
                                    onClick={() => onVote(res.id, 'ABSTAIN')}
                                >
                                    ○ Abstain
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {passedResolutions.length > 0 && (
                <>
                    <h4>Recent Passed Resolutions</h4>
                    <div className="passed-list">
                        {passedResolutions.slice(-3).map((res: UNResolution) => (
                            <div key={res.id} className="passed-item">
                                ✓ {res.title}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// === CRISIS TAB ===
interface CrisisTabProps {
    crises: DiplomaticCrisis[]
    onRespond: (crisisId: string, action: any) => void
}

const PHASE_NAMES = ['', 'Incident', 'Demands', 'Ultimatum', 'Mobilization', 'War']
const CRISIS_ACTIONS = ['BACK_DOWN', 'HOLD_FIRM', 'ESCALATE', 'SEEK_MEDIATION', 'PROPOSE_SUMMIT']

const CrisisTab: React.FC<CrisisTabProps> = ({ crises, onRespond }) => {
    if (crises.length === 0) {
        return (
            <div className="empty-state">
                <p>No active crises</p>
                <small>Crises can arise from territorial disputes, incidents, or AI aggression</small>
            </div>
        )
    }

    return (
        <div className="crisis-tab">
            {crises.map(crisis => (
                <div key={crisis.id} className={`crisis-card phase-${crisis.phase}`}>
                    <div className="crisis-header">
                        <h5>{crisis.title}</h5>
                        <span className={`phase-badge phase-${crisis.phase}`}>
                            Phase {crisis.phase}: {PHASE_NAMES[crisis.phase]}
                        </span>
                    </div>
                    <p>{crisis.description}</p>

                    <div className="crisis-metrics">
                        <div className="war-risk">
                            <span>War Risk</span>
                            <div className="risk-bar">
                                <div
                                    className="risk-fill"
                                    style={{ width: `${crisis.warRisk}%` }}
                                />
                            </div>
                            <span>{crisis.warRisk}%</span>
                        </div>
                    </div>

                    <div className="crisis-actions">
                        {CRISIS_ACTIONS.filter(action => {
                            // Filter actions based on phase
                            if (crisis.phase === 4) return ['BACK_DOWN', 'DECLARE_WAR'].includes(action)
                            if (crisis.phase === 3) return action !== 'SEEK_MEDIATION'
                            return true
                        }).map(action => (
                            <button
                                key={action}
                                className={`action-btn action-${action.toLowerCase()}`}
                                onClick={() => onRespond(crisis.id, action)}
                            >
                                {action.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

// === INFLUENCE TAB ===
const INFLUENCE_ACTIONS: { type: InfluenceActionType, name: string, icon: string, cost: number, covert: boolean }[] = [
    { type: 'CULTURAL_EXCHANGE', name: 'Cultural Exchange', icon: '🎭', cost: 10, covert: false },
    { type: 'ECONOMIC_AID', name: 'Economic Aid', icon: '💵', cost: 20, covert: false },
    { type: 'FUND_OPPOSITION', name: 'Fund Opposition', icon: '🔥', cost: 30, covert: true },
    { type: 'PROPAGANDA_CAMPAIGN', name: 'Propaganda', icon: '📺', cost: 25, covert: true },
    { type: 'ESPIONAGE', name: 'Espionage', icon: '🕵️', cost: 40, covert: true },
    { type: 'HOST_EVENT', name: 'Host Event', icon: '🏆', cost: 50, covert: false }
]

interface InfluenceTabProps {
    softPowerState: any
    countries: any[]
    selectedCountry: string | null
    onSelectCountry: (code: string | null) => void
    onExecuteAction: (action: InfluenceActionType, target: string) => boolean
}

const InfluenceTab: React.FC<InfluenceTabProps> = ({
    softPowerState,
    countries,
    selectedCountry,
    onSelectCountry,
    onExecuteAction
}) => {
    if (!softPowerState) {
        return <div className="empty-state">Initializing soft power...</div>
    }

    const selectedData = countries.find(c => c.code === selectedCountry)

    return (
        <div className="influence-tab">
            <div className="influence-stats">
                <div className="stat">
                    <span className="label">Influence Points</span>
                    <span className="value">{softPowerState.influencePoints}</span>
                </div>
                <div className="stat">
                    <span className="label">World Opinion</span>
                    <span className={`value ${softPowerState.worldOpinion >= 0 ? 'positive' : 'negative'}`}>
                        {softPowerState.worldOpinion >= 0 ? '+' : ''}{softPowerState.worldOpinion}
                    </span>
                </div>
                <div className="stat">
                    <span className="label">Active Ops</span>
                    <span className="value">{softPowerState.activeActions.length}</span>
                </div>
            </div>

            <div className="country-selector">
                <h4>Select Target Country</h4>
                <select
                    value={selectedCountry || ''}
                    onChange={(e) => onSelectCountry(e.target.value || null)}
                >
                    <option value="">-- Select a country --</option>
                    {countries.map(c => (
                        <option key={c.code} value={c.code}>
                            {c.name} ({c.relations >= 0 ? '+' : ''}{c.relations})
                        </option>
                    ))}
                </select>
            </div>

            {selectedCountry && selectedData && (
                <div className="influence-actions">
                    <h4>Actions on {selectedData.name}</h4>
                    <div className="actions-grid">
                        {INFLUENCE_ACTIONS.map(action => {
                            const canAfford = softPowerState.influencePoints >= action.cost
                            return (
                                <button
                                    key={action.type}
                                    className={`influence-action ${action.covert ? 'covert' : ''} ${!canAfford ? 'disabled' : ''}`}
                                    onClick={() => canAfford && onExecuteAction(action.type, selectedCountry)}
                                    disabled={!canAfford}
                                >
                                    <span className="icon">{action.icon}</span>
                                    <span className="name">{action.name}</span>
                                    <span className="cost">{action.cost} 🌟</span>
                                    {action.covert && <span className="covert-badge">Covert</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// === SUMMIT TAB ===
const SUMMIT_TOPICS: { topic: SummitTopic, name: string, description: string }[] = [
    { topic: 'TRADE_DEAL', name: 'Trade Deal', description: 'Negotiate improved trade terms' },
    { topic: 'ALLIANCE', name: 'Military Alliance', description: 'Form a defensive pact' },
    { topic: 'TERRITORIAL', name: 'Border Agreement', description: 'Resolve territorial disputes' },
    { topic: 'ARMS_REDUCTION', name: 'Arms Reduction', description: 'Reduce military spending' }
]

interface SummitTabProps {
    activeSummit: any
    countries: any[]
    onPropose: (target: string, topics: SummitTopic[]) => boolean
}

const SummitTab: React.FC<SummitTabProps> = ({ activeSummit, countries, onPropose }) => {
    const [targetCountry, setTargetCountry] = useState('')
    const [selectedTopics, setSelectedTopics] = useState<SummitTopic[]>([])

    const eligibleCountries = countries.filter(c => c.relations > -50)

    const toggleTopic = (topic: SummitTopic) => {
        setSelectedTopics(prev =>
            prev.includes(topic)
                ? prev.filter(t => t !== topic)
                : [...prev, topic]
        )
    }

    const handlePropose = () => {
        if (targetCountry && selectedTopics.length > 0) {
            onPropose(targetCountry, selectedTopics)
            setSelectedTopics([])
        }
    }

    if (activeSummit) {
        return (
            <div className="summit-active">
                <h4>{activeSummit.title}</h4>
                <p>Status: {activeSummit.status}</p>
                <div className="topics">
                    Topics: {activeSummit.topics.join(', ')}
                </div>
            </div>
        )
    }

    return (
        <div className="summit-tab">
            <h4>Propose a Summit</h4>

            <div className="summit-form">
                <div className="field">
                    <label>Invite Country</label>
                    <select
                        value={targetCountry}
                        onChange={(e) => setTargetCountry(e.target.value)}
                    >
                        <option value="">-- Select country --</option>
                        {eligibleCountries.map(c => (
                            <option key={c.code} value={c.code}>
                                {c.name} ({c.relations >= 0 ? '+' : ''}{c.relations})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="field">
                    <label>Topics to Discuss</label>
                    <div className="topics-grid">
                        {SUMMIT_TOPICS.map(({ topic, name, description }) => (
                            <button
                                key={topic}
                                className={`topic-btn ${selectedTopics.includes(topic) ? 'selected' : ''}`}
                                onClick={() => toggleTopic(topic)}
                            >
                                <span className="topic-name">{name}</span>
                                <span className="topic-desc">{description}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    className="propose-btn"
                    disabled={!targetCountry || selectedTopics.length === 0}
                    onClick={handlePropose}
                >
                    🤝 Propose Summit
                </button>
            </div>
        </div>
    )
}

export default AdvancedDiplomacyPanel

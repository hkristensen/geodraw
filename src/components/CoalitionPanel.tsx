import React, { useState } from 'react'
import { useWorldStore } from '../store/worldStore'
import { useGameStore } from '../store/gameStore'
import { CoalitionType, TariffStatus } from '../types/game'
import { Flag } from './Flag'

import { RELIGIONS, CULTURES } from '../types/game'

const TARIFF_LEVELS: TariffStatus[] = ['FREE_TRADE', 'NONE', 'LOW', 'HIGH', 'EMBARGO']

// Helper for coalition type styling
const getCoalitionTypeStyle = (type: CoalitionType) => {
    switch (type) {
        case 'MILITARY':
            return 'bg-red-500/20 text-red-300 border-red-500/30'
        case 'TRADE':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        case 'RESEARCH':
            return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    }
}

export const CoalitionPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { coalitions, createCoalition, leaveCoalition, requestJoinCoalition } = useWorldStore()
    const { selectedCountry, gameSettings } = useGameStore()

    const playerCode = gameSettings?.startMode === 'EXISTING_COUNTRY' ? gameSettings.startingCountry : 'PLAYER'

    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newCoalitionName, setNewCoalitionName] = useState('')
    const [newCoalitionType, setNewCoalitionType] = useState<CoalitionType>('TRADE')
    const [reqReligion, setReqReligion] = useState<string>('')
    const [reqCulture, setReqCulture] = useState<string>('')
    // New requirement states
    const [reqMinRelations, setReqMinRelations] = useState<number>(0)
    const [reqMilitaryBudget, setReqMilitaryBudget] = useState<number>(20)
    const [reqDefenseContribution, setReqDefenseContribution] = useState<number>(25)
    const [reqTariffLevel, setReqTariffLevel] = useState<TariffStatus>('FREE_TRADE')
    const [reqResearchBudget, setReqResearchBudget] = useState<number>(15)

    const myCoalitions = coalitions.filter(c => c.members.includes(selectedCountry || ''))
    const isPlayer = selectedCountry === playerCode

    const handleCreate = () => {
        if (!newCoalitionName.trim()) return

        // Build requirements based on coalition type
        const requirements: Record<string, any> = {}

        if (reqReligion) requirements.religion = reqReligion
        if (reqCulture) requirements.culture = reqCulture
        if (reqMinRelations > -100) requirements.minRelations = reqMinRelations

        if (newCoalitionType === 'MILITARY') {
            requirements.minMilitaryBudgetPercent = reqMilitaryBudget
            requirements.defenseContributionPercent = reqDefenseContribution
        } else if (newCoalitionType === 'TRADE') {
            requirements.fixedTariffLevel = reqTariffLevel
        } else if (newCoalitionType === 'RESEARCH') {
            requirements.minResearchBudgetPercent = reqResearchBudget
        }

        createCoalition(newCoalitionName, newCoalitionType, requirements)
        setShowCreateForm(false)
        setNewCoalitionName('')
        setReqReligion('')
        setReqCulture('')
        setReqMinRelations(0)
    }

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            🌍 Global Coalitions
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Manage alliances and trade agreements</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* My Coalitions Status */}
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            Your Coalitions
                            {myCoalitions.length > 0 && <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">{myCoalitions.length} Memberships</span>}
                        </h3>

                        {myCoalitions.length > 0 ? (
                            <div className="space-y-4">
                                {myCoalitions.map(coalition => (
                                    <div key={coalition.id} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="text-4xl">{coalition.icon}</span>
                                                    <div>
                                                        <h4 className="text-2xl font-bold text-white">{coalition.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className={`text-xs px-2 py-0.5 rounded border ${getCoalitionTypeStyle(coalition.type)}`}>
                                                                {coalition.type} PACT
                                                            </span>
                                                            <span className="text-slate-400 text-sm">
                                                                • Founded by {coalition.leader === playerCode ? useGameStore.getState().nation?.name : coalition.leader}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => leaveCoalition(coalition.id)}
                                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium"
                                            >
                                                Leave Coalition
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <h5 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Members ({coalition.members.length})</h5>
                                                <div className="flex flex-wrap gap-2">
                                                    {coalition.members.map(member => (
                                                        <div key={member} className="px-3 py-1.5 bg-slate-900 rounded border border-slate-700 text-slate-300 text-sm flex items-center gap-2">
                                                            <img
                                                                src={`/flags/${member.toLowerCase()}.svg`}
                                                                alt={member}
                                                                className="w-5 h-3 object-cover rounded-sm"
                                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                                            />
                                                            {member}
                                                            {member === coalition.leader && <span className="text-xs text-yellow-500">★</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Benefits</h5>
                                                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                                                    <p className="text-slate-300 text-sm leading-relaxed">
                                                        {coalition.type === 'MILITARY'
                                                            ? "🛡️ Mutual Defense: Members automatically join defensive wars. +10% Military Power per member."
                                                            : "💰 Free Trade: +5% GDP Growth per member. Improved relations with all members."
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-slate-800/30 rounded-xl p-8 border border-slate-700 border-dashed text-center">
                                {!showCreateForm ? (
                                    <>
                                        <div className="text-4xl mb-4">🤝</div>
                                        <h4 className="text-xl font-medium text-white mb-2">You are not in any coalition</h4>
                                        <p className="text-slate-400 mb-6 max-w-md mx-auto">
                                            Form alliances to protect your nation or boost your economy. Join an existing coalition or create your own.
                                        </p>
                                        {isPlayer && (
                                            <button
                                                onClick={() => setShowCreateForm(true)}
                                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20"
                                            >
                                                Create New Coalition
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="max-w-md mx-auto text-left">
                                        <h4 className="text-lg font-medium text-white mb-4">Create New Coalition</h4>

                                        <div className="mb-4">
                                            <label className="block text-slate-400 text-sm mb-2">Coalition Name</label>
                                            <input
                                                type="text"
                                                value={newCoalitionName}
                                                onChange={(e) => setNewCoalitionName(e.target.value)}
                                                placeholder="e.g. Northern Alliance"
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div className="mb-6">
                                            <label className="block text-slate-400 text-sm mb-2">Type</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => setNewCoalitionType('MILITARY')}
                                                    className={`p-3 rounded-lg border text-center transition-all ${newCoalitionType === 'MILITARY'
                                                        ? 'bg-red-500/20 border-red-500 text-white'
                                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                                        }`}
                                                >
                                                    <div className="text-xl mb-1">🛡️</div>
                                                    <div className="font-medium">Military</div>
                                                </button>
                                                <button
                                                    onClick={() => setNewCoalitionType('TRADE')}
                                                    className={`p-3 rounded-lg border text-center transition-all ${newCoalitionType === 'TRADE'
                                                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                                        }`}
                                                >
                                                    <div className="text-xl mb-1">💰</div>
                                                    <div className="font-medium">Trade</div>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <label className="block text-slate-400 text-sm mb-2">Requirements (Optional)</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-slate-500 mb-1 block">Religion</label>
                                                    <select
                                                        value={reqReligion}
                                                        onChange={(e) => setReqReligion(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                                    >
                                                        <option value="">None</option>
                                                        {RELIGIONS.map(r => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-slate-500 mb-1 block">Culture</label>
                                                    <select
                                                        value={reqCulture}
                                                        onChange={(e) => setReqCulture(e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                                                    >
                                                        <option value="">None</option>
                                                        {CULTURES.map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleCreate}
                                                disabled={!newCoalitionName.trim()}
                                                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                                            >
                                                Create Coalition
                                            </button>
                                            <button
                                                onClick={() => setShowCreateForm(false)}
                                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* All Coalitions List */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-white">Active Coalitions</h3>
                            {!showCreateForm && isPlayer && (
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded border border-blue-500/30 transition-colors"
                                >
                                    + Create New
                                </button>
                            )}
                        </div>

                        {/* Create Form - shown when showCreateForm is true */}
                        {showCreateForm && (
                            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 mb-6">
                                <h4 className="text-lg font-medium text-white mb-4">Create New Coalition</h4>

                                <div className="mb-4">
                                    <label className="block text-slate-400 text-sm mb-2">Coalition Name</label>
                                    <input
                                        type="text"
                                        value={newCoalitionName}
                                        onChange={(e) => setNewCoalitionName(e.target.value)}
                                        placeholder="e.g. Northern Alliance"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="mb-6">
                                    <label className="block text-slate-400 text-sm mb-2">Type</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            onClick={() => setNewCoalitionType('MILITARY')}
                                            className={`p-3 rounded-lg border text-center transition-all ${newCoalitionType === 'MILITARY'
                                                ? 'bg-red-500/20 border-red-500 text-white'
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            <div className="text-xl mb-1">🛡️</div>
                                            <div className="font-medium">Military</div>
                                        </button>
                                        <button
                                            onClick={() => setNewCoalitionType('TRADE')}
                                            className={`p-3 rounded-lg border text-center transition-all ${newCoalitionType === 'TRADE'
                                                ? 'bg-emerald-500/20 border-emerald-500 text-white'
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            <div className="text-xl mb-1">💰</div>
                                            <div className="font-medium">Trade</div>
                                        </button>
                                        <button
                                            onClick={() => setNewCoalitionType('RESEARCH')}
                                            className={`p-3 rounded-lg border text-center transition-all ${newCoalitionType === 'RESEARCH'
                                                ? 'bg-blue-500/20 border-blue-500 text-white'
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            <div className="text-xl mb-1">🔬</div>
                                            <div className="font-medium">Research</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Type-specific requirements */}
                                {newCoalitionType === 'MILITARY' && (
                                    <div className="mb-6 bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                                        <label className="block text-red-300 text-sm mb-3 font-medium">🛡️ Military Requirements</label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Min Military Budget %</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={reqMilitaryBudget}
                                                    onChange={(e) => setReqMilitaryBudget(Number(e.target.value))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400 mb-1 block">Defense Contribution %</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={reqDefenseContribution}
                                                    onChange={(e) => setReqDefenseContribution(Number(e.target.value))}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">Members contribute this % of their army when an ally is attacked</p>
                                    </div>
                                )}

                                {newCoalitionType === 'TRADE' && (
                                    <div className="mb-6 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                                        <label className="block text-emerald-300 text-sm mb-3 font-medium">💰 Trade Requirements</label>
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Fixed Tariff Level Between Members</label>
                                            <select
                                                value={reqTariffLevel}
                                                onChange={(e) => setReqTariffLevel(e.target.value as TariffStatus)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                            >
                                                {TARIFF_LEVELS.map(level => (
                                                    <option key={level} value={level}>{level}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {newCoalitionType === 'RESEARCH' && (
                                    <div className="mb-6 bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                                        <label className="block text-blue-300 text-sm mb-3 font-medium">🔬 Research Requirements</label>
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Min Research Budget %</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={reqResearchBudget}
                                                onChange={(e) => setReqResearchBudget(Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Common requirements */}
                                <div className="mb-6">
                                    <label className="block text-slate-400 text-sm mb-3">Common Requirements</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Min Relations</label>
                                            <input
                                                type="number"
                                                min="-100"
                                                max="100"
                                                value={reqMinRelations}
                                                onChange={(e) => setReqMinRelations(Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Religion</label>
                                            <select
                                                value={reqReligion}
                                                onChange={(e) => setReqReligion(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                            >
                                                <option value="">Any</option>
                                                {RELIGIONS.map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500 mb-1 block">Culture</label>
                                            <select
                                                value={reqCulture}
                                                onChange={(e) => setReqCulture(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                                            >
                                                <option value="">Any</option>
                                                {CULTURES.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>



                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newCoalitionName.trim()}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                                    >
                                        Create Coalition
                                    </button>
                                    <button
                                        onClick={() => setShowCreateForm(false)}
                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {coalitions.filter(c => !myCoalitions.some(mc => mc.id === c.id)).map(coalition => (
                                <div key={coalition.id} className="bg-slate-800/30 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-3xl">{coalition.icon}</span>
                                            <div>
                                                <h4 className="text-lg font-bold text-white">{coalition.name}</h4>
                                                <div className="flex flex-col gap-1 mt-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getCoalitionTypeStyle(coalition.type)}`}>
                                                            {coalition.type}
                                                        </span>
                                                        <span className="text-slate-500 text-xs">{coalition.members.length} Members</span>
                                                    </div>
                                                    {coalition.requirements && (
                                                        <div className="flex gap-1">
                                                            {coalition.requirements.religion && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                                    ✝️ {coalition.requirements.religion}
                                                                </span>
                                                            )}
                                                            {coalition.requirements.culture && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20">
                                                                    🎭 {coalition.requirements.culture}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {isPlayer && (
                                            <button
                                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded border border-slate-600 transition-colors"
                                                onClick={() => requestJoinCoalition(coalition.id)}
                                            >
                                                Request Join
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {coalition.members.slice(0, 8).map(member => (
                                            <span key={member} className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400 border border-slate-800 flex items-center gap-1">
                                                {member === playerCode && useGameStore.getState().nation ? (
                                                    <div className="w-3 h-2 rounded-sm overflow-hidden border border-white/20 inline-block">
                                                        <Flag flag={useGameStore.getState().nation!.flag} />
                                                    </div>
                                                ) : null}
                                                {member === playerCode ? useGameStore.getState().nation?.name : member}
                                            </span>
                                        ))}
                                        {coalition.members.length > 8 && (
                                            <span className="px-2 py-1 bg-slate-900/50 rounded text-xs text-slate-500">
                                                +{coalition.members.length - 8} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {coalitions.length === 0 && (
                                <div className="col-span-2 text-center py-8 text-slate-500 italic">
                                    No active coalitions in the world.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

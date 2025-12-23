import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { calculateEconomy, formatMoney } from '../utils/economy'
import { Flag } from './Flag'
import { BudgetPanel } from './BudgetPanel'
import { BuildingPanel } from './BuildingPanel'
import { ResearchPanel } from './ResearchPanel'
import { PolicyPanel } from './PolicyPanel'
import { NuclearPanel } from './NuclearPanel'

function formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return num.toLocaleString()
}

export function NationInfoPanel() {
    const { nation, consequences, annexedCountries, infrastructureStats, gameDate } = useGameStore()
    const { activeWars, allies, aiCountries } = useWorldStore()
    const [activeTab, setActiveTab] = useState<'overview' | 'economy' | 'build' | 'stats'>('overview')
    const [economyData, setEconomyData] = useState<ReturnType<typeof calculateEconomy> | null>(null)
    const [showResearch, setShowResearch] = useState(false)
    const [showPolicies, setShowPolicies] = useState(false)
    const [showNuclear, setShowNuclear] = useState(false)

    const { researchPoints, unrest, unlockedTechs } = useGameStore()

    // Update economy data periodically or when stats change
    useEffect(() => {
        if (nation) {
            const data = calculateEconomy(nation, infrastructureStats, aiCountries)
            setEconomyData(data)
        }
    }, [nation, infrastructureStats, aiCountries])

    if (!nation) {
        return (
            <div className="absolute top-4 left-4 z-10">
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                    🌍 Charted Territory
                </h1>
                <p className="text-sm text-gray-300 drop-shadow">
                    Draw your borders, claim your land
                </p>
            </div>
        )
    }

    const totalArea = consequences.reduce((sum, c) => sum + c.lostArea, 0)
    const totalPop = consequences.reduce((sum, c) => sum + c.populationCaptured, 0)

    return (
        <>
            <div className="absolute top-4 left-4 z-10 w-80">
                {/* Main Nation Card */}
                <div className="bg-slate-900/95 backdrop-blur-md rounded-xl border border-orange-500/30 shadow-2xl overflow-hidden">
                    {/* Header with flag */}
                    <div className="bg-gradient-to-r from-orange-600/20 to-amber-600/20 p-4 border-b border-orange-500/20">
                        <div className="flex items-center gap-3">
                            {/* Flag */}
                            <div className="w-12 h-8 rounded border border-white/20 overflow-hidden flex shadow-lg flex-shrink-0">
                                <Flag flag={nation.flag} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white">{nation.name}</h1>
                                <p className="text-xs text-orange-400 font-mono">
                                    {new Date(gameDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'overview'
                                ? 'bg-white/10 text-orange-400 border-b-2 border-orange-400'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('economy')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'economy'
                                ? 'bg-white/10 text-green-400 border-b-2 border-green-400'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            Economy
                        </button>
                        <button
                            onClick={() => setActiveTab('build')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'build'
                                ? 'bg-white/10 text-orange-400 border-b-2 border-orange-400'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            Build
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'stats'
                                ? 'bg-white/10 text-purple-400 border-b-2 border-purple-400'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                                }`}
                        >
                            Stats
                        </button>
                    </div>

                    {activeTab === 'overview' && (
                        <>
                            {/* Main Stats */}
                            <div className="p-3 border-b border-white/5">
                                <div className="grid grid-cols-4 gap-1 text-center text-xs">
                                    <div className="bg-black/30 rounded p-1.5" title="Total Power">
                                        <div className="text-yellow-400 font-bold">{formatNumber(nation.stats.power)}</div>
                                        <div className="text-gray-500 text-[10px] uppercase">Power</div>
                                    </div>
                                    <div className="bg-black/30 rounded p-1.5" title="Authority">
                                        <div className="text-purple-400 font-bold">{nation.stats.diplomaticPower}</div>
                                        <div className="text-gray-500 text-[10px] uppercase">Auth</div>
                                    </div>
                                    <div className="bg-black/30 rounded p-1.5" title="Economy Score">
                                        <div className="text-green-400 font-bold">{Math.min(100, Math.floor(nation.stats.wealth / 1000000))}</div>
                                        <div className="text-gray-500 text-[10px] uppercase">Econ</div>
                                    </div>
                                    <div className="bg-black/30 rounded p-1.5" title="Active Soldiers">
                                        <div className="text-red-400 font-bold">{formatNumber(nation.stats.soldiers)}</div>
                                        <div className="text-gray-500 text-[10px] uppercase">Army</div>
                                    </div>
                                </div>
                            </div>



                            {/* Management Buttons */}
                            <div className="p-3 border-b border-white/5 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setShowResearch(true)}
                                    className="bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/30 p-2 rounded flex items-center justify-center gap-2 transition-colors"
                                >
                                    <span className="text-lg">🔬</span>
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-blue-300">Research</div>
                                        <div className="text-[10px] text-blue-400">{Math.floor(researchPoints)} RP</div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setShowPolicies(true)}
                                    className="bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/30 p-2 rounded flex items-center justify-center gap-2 transition-colors"
                                >
                                    <span className="text-lg">📜</span>
                                    <div className="text-left">
                                        <div className="text-xs font-bold text-purple-300">Policies</div>
                                        <div className={`text-[10px] ${unrest <= 20 ? 'text-green-400' :
                                            unrest <= 40 ? 'text-yellow-400' :
                                                unrest <= 60 ? 'text-orange-400' :
                                                    'text-red-400'
                                            }`}>
                                            {unrest <= 20 ? 'Stable' :
                                                unrest <= 40 ? 'Low Unrest' :
                                                    unrest <= 60 ? 'Moderate Unrest' :
                                                        unrest <= 80 ? 'High Unrest' :
                                                            'Critical Unrest'}
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Nuclear Program Button - only show if any nuclear tech unlocked */}
                            {unlockedTechs.includes('nuke_1') && (
                                <div className="px-3 pb-3 border-b border-white/5">
                                    <button
                                        onClick={() => setShowNuclear(true)}
                                        className="w-full bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-500/30 p-2 rounded flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <span className="text-lg">☢️</span>
                                        <div className="text-left">
                                            <div className="text-xs font-bold text-yellow-300">Nuclear Program</div>
                                            <div className="text-[10px] text-yellow-400">
                                                💣 {nation?.stats?.nuclearProgram?.warheads || 0} Warheads
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )}

                            {/* Territory Stats */}
                            <div className="p-3 border-b border-white/5">
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                    <div>
                                        <div className="text-orange-400 font-bold">
                                            {infrastructureStats ? (infrastructureStats.totalPopulation / 1_000_000).toFixed(1) : (totalPop / 1_000_000).toFixed(1)}M
                                        </div>
                                        <div className="text-gray-500">Population</div>
                                    </div>
                                    <div>
                                        <div className="text-orange-400 font-bold">
                                            {infrastructureStats ? (infrastructureStats.totalAreaKm2 / 1000).toFixed(0) : (totalArea / 1000).toFixed(0)}K
                                        </div>
                                        <div className="text-gray-500">km²</div>
                                    </div>
                                    <div>
                                        <div className="text-green-400 font-bold">{annexedCountries.length}</div>
                                        <div className="text-gray-500">Annexed</div>
                                    </div>
                                </div>
                            </div>

                            {/* Capital */}
                            {nation.capital && (
                                <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
                                    <span className="text-lg">🏛️</span>
                                    <div>
                                        <div className="text-xs text-gray-500">Capital</div>
                                        <div className="text-white text-sm font-medium">{nation.capital.name}</div>
                                    </div>
                                </div>
                            )}

                            {/* Constitution */}
                            <div className="p-3 grid grid-cols-3 gap-1 text-xs">
                                <div className="flex items-center gap-1">
                                    <span>🗣️</span>
                                    <span className="text-gray-400 truncate">{nation.constitution.language}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>🎭</span>
                                    <span className="text-gray-400 truncate">{nation.constitution.culture}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>⛪</span>
                                    <span className="text-gray-400 truncate">{nation.constitution.religion}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'economy' && (
                        <div className="p-4 space-y-4">
                            {/* Treasury */}
                            <div className="bg-black/30 rounded-lg p-3 text-center border border-white/5">
                                <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Treasury</div>
                                <div className="text-2xl font-bold text-yellow-400 font-mono">
                                    {formatMoney(nation.stats.budget)}
                                </div>
                                {economyData && (
                                    <div className={`text-xs font-bold mt-1 ${economyData.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {economyData.netIncome >= 0 ? '+' : ''}{formatMoney(economyData.netIncome)} / year
                                    </div>
                                )}
                            </div>

                            {/* Budget Panel Controls */}
                            <BudgetPanel />

                            {/* Income Breakdown */}
                            {economyData && (
                                <div className="space-y-2 text-xs border-t border-white/10 pt-4">
                                    <div className="flex justify-between items-center text-green-400">
                                        <span>Income</span>
                                        <span className="font-bold">+{formatMoney(economyData.totalIncome)}</span>
                                    </div>
                                    <div className="pl-2 space-y-1 text-gray-400">
                                        <div className="flex justify-between">
                                            <span>Trade</span>
                                            <span>{formatMoney(economyData.tradeIncome)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Taxes</span>
                                            <span>{formatMoney(economyData.taxIncome)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-red-400 mt-2">
                                        <span>Expenses</span>
                                        <span className="font-bold">-{formatMoney(economyData.expenses)}</span>
                                    </div>
                                    <div className="pl-2 space-y-1 text-gray-400">
                                        <div className="flex justify-between">
                                            <span>Total Expenses</span>
                                            <span>{formatMoney(economyData.expenses)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'build' && (
                        <div className="p-4">
                            <BuildingPanel />
                        </div>
                    )}

                    {activeTab === 'stats' && (
                        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            {/* Modifiers */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Active Modifiers</h3>
                                <div className="space-y-2">
                                    {activeWars.length > 0 && (
                                        <div className="bg-red-900/30 border border-red-500/30 p-2 rounded flex justify-between items-center">
                                            <span className="text-red-400 text-xs font-bold">At War</span>
                                            <span className="text-red-300 text-xs">Economy -20%</span>
                                        </div>
                                    )}
                                    {allies.length > 0 && (
                                        <div className="bg-green-900/30 border border-green-500/30 p-2 rounded flex justify-between items-center">
                                            <span className="text-green-400 text-xs font-bold">Alliances ({allies.length})</span>
                                            <span className="text-green-300 text-xs">Diplomacy +{allies.length * 10}%</span>
                                        </div>
                                    )}
                                    {activeWars.length === 0 && allies.length === 0 && (
                                        <div className="text-gray-500 text-xs italic text-center py-2">No active modifiers</div>
                                    )}
                                </div>
                            </div>

                            {/* Policy Effects */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Policy Effects</h3>
                                <div className="space-y-2 text-xs">
                                    <div className="bg-white/5 p-2 rounded flex justify-between items-center">
                                        <span className="text-blue-300">Social Spending</span>
                                        <span className="text-green-400 font-bold">+{Math.round(nation.stats.budgetAllocation.social / 2)}% Stability</span>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded flex justify-between items-center">
                                        <span className="text-red-300">Military Budget</span>
                                        <span className="text-green-400 font-bold">+{Math.round(nation.stats.budgetAllocation.military / 2)}% Defence</span>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded flex justify-between items-center">
                                        <span className="text-yellow-300">Infrastructure</span>
                                        <span className="text-green-400 font-bold">+{Math.round(nation.stats.budgetAllocation.infrastructure / 2)}% Growth</span>
                                    </div>
                                    <div className="bg-white/5 p-2 rounded flex justify-between items-center">
                                        <span className="text-purple-300">Research</span>
                                        <span className="text-green-400 font-bold">+{Math.round(nation.stats.budgetAllocation.research / 2)}% Tech</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Stats */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">National Statistics</h3>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black/30 p-2 rounded">
                                        <div className="text-gray-500">GDP/Capita</div>
                                        <div className="text-white font-mono">{formatMoney(nation.stats.gdpPerCapita)}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded">
                                        <div className="text-gray-500">Tax Rate</div>
                                        <div className="text-white font-mono">{nation.stats.taxRate}%</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded">
                                        <div className="text-gray-500">Manpower</div>
                                        <div className="text-white font-mono">{formatNumber(nation.stats.manpower)}</div>
                                    </div>
                                    <div className="bg-black/30 p-2 rounded">
                                        <div className="text-gray-500">Defence</div>
                                        <div className="text-white font-mono">{nation.stats.defence}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* War Status Footer */}
                    {activeWars.length > 0 && (
                        <div className="px-4 py-2 bg-red-900/40 border-t border-red-500/30">
                            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                <span>⚔️</span>
                                <span>AT WAR with {activeWars.length} nation{activeWars.length > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    )}

                    {/* Alliance Status Footer */}
                    {allies.length > 0 && (
                        <div className="px-4 py-2 bg-green-900/40 border-t border-green-500/30">
                            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                                <span>🤝</span>
                                <span>{allies.length} Alliance{allies.length > 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Modals */}
            {showResearch && <ResearchPanel onClose={() => setShowResearch(false)} />}
            {showPolicies && <PolicyPanel onClose={() => setShowPolicies(false)} />}
            {showNuclear && <NuclearPanel onClose={() => setShowNuclear(false)} />}
        </>
    )
}

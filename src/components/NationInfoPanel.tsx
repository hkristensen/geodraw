import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { calculateEconomy, formatMoney } from '../utils/economy'
import { Flag } from './Flag'
import { BudgetPanel } from './BudgetPanel'
import { BuildingPanel } from './BuildingPanel'

function formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return num.toLocaleString()
}

export function NationInfoPanel() {
    const { nation, consequences, annexedCountries, infrastructureStats, gameDate } = useGameStore()
    const { activeWars, allies, aiCountries } = useWorldStore()
    const [activeTab, setActiveTab] = useState<'overview' | 'economy' | 'build'>('overview')
    const [economyData, setEconomyData] = useState<ReturnType<typeof calculateEconomy> | null>(null)

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

                {/* War Status */}
                {activeWars.length > 0 && (
                    <div className="px-4 py-2 bg-red-900/40 border-t border-red-500/30">
                        <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                            <span>⚔️</span>
                            <span>AT WAR with {activeWars.length} nation{activeWars.length > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                )}

                {/* Alliance Status */}
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
    )
}

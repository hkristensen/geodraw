import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import type { NuclearProgram } from '../types/game'

// Costs in billions
const REACTOR_COST = 500_000_000_000 // 500B
const ENRICHMENT_FACILITY_COST = 1_000_000_000_000 // 1T
const WARHEAD_COST = 200_000_000_000 // 200B per warhead
const ENRICHMENT_TIME = 300_000 // 5 minutes in ms

export function NuclearPanel({ onClose }: { onClose: () => void }) {
    const { nation, unlockedTechs, updateBudget } = useGameStore()
    const [nuclearProgram, setNuclearProgram] = useState<NuclearProgram>(
        nation?.stats?.nuclearProgram || {
            enrichmentProgress: 0,
            warheads: 0,
            reactors: 0,
            enrichmentFacilities: 0
        }
    )

    // Track if we need to sync to store
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Check what's unlocked
    const hasEnrichment = unlockedTechs.includes('nuke_3')
    const hasWeapons = unlockedTechs.includes('nuke_4')
    const hasPower = unlockedTechs.includes('nuke_2')

    const budget = nation?.stats?.budget || 0

    // Sync to store (debounced to prevent loops)
    const syncToStore = useCallback((program: NuclearProgram) => {
        useGameStore.setState(state => ({
            nation: state.nation ? {
                ...state.nation,
                stats: {
                    ...state.nation.stats,
                    nuclearProgram: program
                }
            } : null
        }))
    }, [])

    // Enrichment progress ticker
    useEffect(() => {
        if (!hasEnrichment || nuclearProgram.enrichmentFacilities === 0) return

        const interval = setInterval(() => {
            setNuclearProgram(prev => {
                if (prev.enrichmentProgress >= 100) return prev
                // Progress based on number of facilities
                const progressPerTick = (100 / (ENRICHMENT_TIME / 1000)) * prev.enrichmentFacilities
                const newProgress = Math.min(100, prev.enrichmentProgress + progressPerTick)
                const updatedProgram = { ...prev, enrichmentProgress: newProgress }

                // Debounced sync to store (don't sync every tick, just every 5 seconds)
                if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
                syncTimeoutRef.current = setTimeout(() => syncToStore(updatedProgram), 5000)

                return updatedProgram
            })
        }, 1000)

        return () => {
            clearInterval(interval)
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        }
    }, [hasEnrichment, nuclearProgram.enrichmentFacilities, syncToStore])

    const buildReactor = () => {
        if (budget >= REACTOR_COST && hasPower) {
            updateBudget(-REACTOR_COST)
            setNuclearProgram(prev => {
                const updated = { ...prev, reactors: prev.reactors + 1 }
                syncToStore(updated)
                return updated
            })
        }
    }

    const buildEnrichmentFacility = () => {
        if (budget >= ENRICHMENT_FACILITY_COST && hasEnrichment) {
            updateBudget(-ENRICHMENT_FACILITY_COST)
            setNuclearProgram(prev => {
                const updated = { ...prev, enrichmentFacilities: prev.enrichmentFacilities + 1 }
                syncToStore(updated)
                return updated
            })
        }
    }

    const buildWarhead = () => {
        if (budget >= WARHEAD_COST && hasWeapons && nuclearProgram.enrichmentProgress >= 100) {
            updateBudget(-WARHEAD_COST)
            setNuclearProgram(prev => {
                const updated = {
                    ...prev,
                    warheads: prev.warheads + 1,
                    enrichmentProgress: 0 // Reset enrichment for next warhead
                }
                syncToStore(updated)
                return updated
            })
        }
    }

    const formatCost = (cost: number) => {
        if (cost >= 1_000_000_000_000) return `${(cost / 1_000_000_000_000).toFixed(1)}T`
        return `${(cost / 1_000_000_000).toFixed(0)}B`
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-yellow-500/20 flex justify-between items-center bg-gradient-to-r from-yellow-900/30 to-red-900/30">
                    <div>
                        <h2 className="text-2xl font-bold text-yellow-400">☢️ Nuclear Program</h2>
                        <p className="text-gray-400 text-sm">Manage your nation's nuclear capabilities</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-red-900/40 px-4 py-2 rounded-lg border border-red-500/30">
                            <span className="text-red-300 font-mono text-xl">💣 {nuclearProgram.warheads}</span>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Status Overview */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div className="text-sm text-gray-400">Reactors</div>
                            <div className="text-2xl font-bold text-cyan-400">⚛️ {nuclearProgram.reactors}</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div className="text-sm text-gray-400">Enrichment Facilities</div>
                            <div className="text-2xl font-bold text-yellow-400">🏭 {nuclearProgram.enrichmentFacilities}</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                            <div className="text-sm text-gray-400">Nuclear Warheads</div>
                            <div className="text-2xl font-bold text-red-400">💣 {nuclearProgram.warheads}</div>
                        </div>
                    </div>

                    {/* Enrichment Progress */}
                    {hasEnrichment && (
                        <div className="bg-slate-800 p-4 rounded-xl border border-yellow-500/30">
                            <div className="flex justify-between mb-2">
                                <span className="text-yellow-400 font-bold">Uranium Enrichment Progress</span>
                                <span className="text-yellow-300">{nuclearProgram.enrichmentProgress.toFixed(1)}%</span>
                            </div>
                            <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-500 to-red-500 transition-all duration-500"
                                    style={{ width: `${nuclearProgram.enrichmentProgress}%` }}
                                />
                            </div>
                            {nuclearProgram.enrichmentFacilities === 0 && (
                                <p className="text-xs text-gray-500 mt-2">Build an enrichment facility to start producing weapons-grade uranium</p>
                            )}
                            {nuclearProgram.enrichmentProgress >= 100 && hasWeapons && (
                                <p className="text-xs text-green-400 mt-2">✓ Enough enriched uranium for one warhead!</p>
                            )}
                        </div>
                    )}

                    {/* Build Options */}
                    <div className="space-y-3">
                        {/* Nuclear Reactor */}
                        <button
                            disabled={!hasPower || budget < REACTOR_COST}
                            onClick={buildReactor}
                            className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all ${hasPower && budget >= REACTOR_COST
                                ? 'bg-cyan-900/20 border-cyan-500/50 hover:bg-cyan-900/40'
                                : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <div className="text-left">
                                <div className="font-bold text-cyan-400">⚛️ Build Nuclear Reactor</div>
                                <div className="text-xs text-gray-400">Generates power, reduces costs by 5%</div>
                            </div>
                            <div className={`font-mono ${budget >= REACTOR_COST ? 'text-green-400' : 'text-red-400'}`}>
                                ${formatCost(REACTOR_COST)}
                            </div>
                        </button>

                        {/* Enrichment Facility */}
                        <button
                            disabled={!hasEnrichment || budget < ENRICHMENT_FACILITY_COST}
                            onClick={buildEnrichmentFacility}
                            className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all ${hasEnrichment && budget >= ENRICHMENT_FACILITY_COST
                                ? 'bg-yellow-900/20 border-yellow-500/50 hover:bg-yellow-900/40'
                                : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <div className="text-left">
                                <div className="font-bold text-yellow-400">🏭 Build Enrichment Facility</div>
                                <div className="text-xs text-gray-400">Produces weapons-grade uranium over time</div>
                            </div>
                            <div className={`font-mono ${budget >= ENRICHMENT_FACILITY_COST ? 'text-green-400' : 'text-red-400'}`}>
                                ${formatCost(ENRICHMENT_FACILITY_COST)}
                            </div>
                        </button>

                        {/* Build Warhead */}
                        <button
                            disabled={!hasWeapons || budget < WARHEAD_COST || nuclearProgram.enrichmentProgress < 100}
                            onClick={buildWarhead}
                            className={`w-full p-4 rounded-xl border flex justify-between items-center transition-all ${hasWeapons && budget >= WARHEAD_COST && nuclearProgram.enrichmentProgress >= 100
                                ? 'bg-red-900/20 border-red-500/50 hover:bg-red-900/40'
                                : 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed'
                                }`}
                        >
                            <div className="text-left">
                                <div className="font-bold text-red-400">💣 Build Nuclear Warhead</div>
                                <div className="text-xs text-gray-400">
                                    {nuclearProgram.enrichmentProgress < 100
                                        ? `Requires 100% enriched uranium (${nuclearProgram.enrichmentProgress.toFixed(0)}%)`
                                        : 'Ready to build!'
                                    }
                                </div>
                            </div>
                            <div className={`font-mono ${budget >= WARHEAD_COST ? 'text-green-400' : 'text-red-400'}`}>
                                ${formatCost(WARHEAD_COST)}
                            </div>
                        </button>
                    </div>

                    {/* Warnings */}
                    {!hasPower && !hasEnrichment && !hasWeapons && (
                        <div className="bg-orange-900/20 border border-orange-500/30 p-4 rounded-xl">
                            <p className="text-orange-400 text-sm">
                                ⚠️ You need to research <strong>Nuclear Physics</strong> first to unlock nuclear technology.
                            </p>
                        </div>
                    )}

                    {nuclearProgram.warheads > 0 && (
                        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-xl">
                            <p className="text-red-400 text-sm">
                                ☢️ <strong>Warning:</strong> Using nuclear weapons will cause massive destruction and severe diplomatic consequences.
                                Coalition members of the target may retaliate with their own nuclear weapons.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

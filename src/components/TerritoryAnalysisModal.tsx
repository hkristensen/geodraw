/**
 * Territory Analysis Modal
 * Shows detailed information about claimed territory:
 * - Cities, population, religions, economy, airports, ports
 */

import { useMemo } from 'react'
import type { Feature, Polygon, MultiPolygon } from 'geojson'
import { calculateInfrastructure } from '../utils/infrastructure'
import { getCountryData } from '../utils/countryData'
import { useGameStore } from '../store/gameStore'

interface TerritoryAnalysisModalProps {
    polygon: Feature<Polygon | MultiPolygon>
    onConfirm: () => void
}

export function TerritoryAnalysisModal({ polygon, onConfirm }: TerritoryAnalysisModalProps) {
    const { consequences } = useGameStore()

    // Calculate infrastructure in the territory
    const infrastructure = useMemo(() => {
        return calculateInfrastructure(polygon)
    }, [polygon])

    // Get top 5 cities by population
    const topCities = useMemo(() => {
        return infrastructure.cities
            .sort((a, b) => b.population - a.population)
            .slice(0, 5)
    }, [infrastructure.cities])

    // Calculate total population from consequences
    const totalPopulation = useMemo(() => {
        return consequences.reduce((sum, c) => sum + c.populationCaptured, 0)
    }, [consequences])

    // Calculate total area from consequences
    const totalArea = useMemo(() => {
        return consequences.reduce((sum, c) => sum + c.lostArea, 0)
    }, [consequences])

    // Count major/medium airports
    const majorAirports = infrastructure.airports.filter(a => a.type === 'major').length
    const mediumAirports = infrastructure.airports.filter(a => a.type === 'medium').length

    // Count major/medium ports
    const majorPorts = infrastructure.ports.filter(p => p.type === 'major').length
    const mediumPorts = infrastructure.ports.filter(p => p.type === 'medium').length

    // Calculate weighted religion breakdown
    const religionBreakdown = useMemo(() => {
        const religionCounts: Record<string, number> = {}
        let totalWeightedPop = 0

        consequences.forEach(c => {
            const countryData = getCountryData(c.countryCode)
            if (countryData?.religions) {
                const capturedPop = c.populationCaptured
                totalWeightedPop += capturedPop

                Object.entries(countryData.religions).forEach(([rel, pct]) => {
                    religionCounts[rel] = (religionCounts[rel] || 0) + (capturedPop * ((pct as number) / 100))
                })
            }
        })

        return Object.entries(religionCounts)
            .map(([religion, count]) => ({
                religion,
                percent: totalWeightedPop > 0 ? (count / totalWeightedPop) * 100 : 0
            }))
            .sort((a, b) => b.percent - a.percent)
            .filter(r => r.percent > 1) // Filter out small minorities
    }, [consequences])

    // Calculate weighted economic stats
    const economicStats = useMemo(() => {
        let totalWeightedPop = 0
        let weightedProsperity = 0
        let weightedFreedom = 0

        consequences.forEach(c => {
            const countryData = getCountryData(c.countryCode)
            if (countryData) {
                const capturedPop = c.populationCaptured
                totalWeightedPop += capturedPop
                weightedProsperity += (countryData.prosperityIndex || 50) * capturedPop
                weightedFreedom += (countryData.economicFreedomIndex || 50) * capturedPop
            }
        })

        return {
            prosperity: totalWeightedPop > 0 ? weightedProsperity / totalWeightedPop : 50,
            freedom: totalWeightedPop > 0 ? weightedFreedom / totalWeightedPop : 50
        }
    }, [consequences])

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-900/95 rounded-2xl border border-orange-500/30 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600/20 to-amber-600/20 p-5 border-b border-orange-500/30">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        📊 Territory Analysis
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                        Your claimed territory contains the following resources
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="p-5 space-y-4">
                    {/* Top row - Key stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-black/30 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-orange-400">
                                {(totalPopulation / 1_000_000).toFixed(1)}M
                            </div>
                            <div className="text-xs text-gray-500">Population</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-blue-400">
                                {(totalArea / 1000).toFixed(0)}K
                            </div>
                            <div className="text-xs text-gray-500">km²</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-green-400">
                                {consequences.length}
                            </div>
                            <div className="text-xs text-gray-500">Countries</div>
                        </div>
                    </div>

                    {/* Infrastructure */}
                    <div className="bg-black/20 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            🏗️ Infrastructure
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-xl">✈️</span>
                                <div>
                                    <div className="text-white font-medium">{infrastructure.totalAirports} Airports</div>
                                    <div className="text-xs text-gray-500">
                                        {majorAirports} major, {mediumAirports} medium
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-xl">⚓</span>
                                <div>
                                    <div className="text-white font-medium">{infrastructure.totalPorts} Ports</div>
                                    <div className="text-xs text-gray-500">
                                        {majorPorts} major, {mediumPorts} medium
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Access indicators */}
                        <div className="flex gap-2 mt-3">
                            {infrastructure.hasAirAccess ? (
                                <span className="px-2 py-1 bg-blue-900/50 text-blue-300 text-xs rounded-full">
                                    ✓ Air Access
                                </span>
                            ) : (
                                <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded-full">
                                    ✗ No Air Access
                                </span>
                            )}
                            {infrastructure.hasSeaAccess ? (
                                <span className="px-2 py-1 bg-cyan-900/50 text-cyan-300 text-xs rounded-full">
                                    ✓ Sea Access
                                </span>
                            ) : (
                                <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded-full">
                                    ✗ Landlocked
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Demographics & Economy */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Religion */}
                        <div className="bg-black/20 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                🛐 Religion
                            </h3>
                            <div className="space-y-2">
                                {religionBreakdown.slice(0, 3).map((r, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-300">{r.religion}</span>
                                        <span className="text-gray-400">{r.percent.toFixed(1)}%</span>
                                    </div>
                                ))}
                                {religionBreakdown.length === 0 && (
                                    <div className="text-xs text-gray-500 italic">No data available</div>
                                )}
                            </div>
                        </div>

                        {/* Economy */}
                        <div className="bg-black/20 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                💰 Economy
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Prosperity</span>
                                        <span>{economicStats.prosperity.toFixed(0)}/100</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${economicStats.prosperity}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Freedom</span>
                                        <span>{economicStats.freedom.toFixed(0)}/100</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500"
                                            style={{ width: `${economicStats.freedom}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Major Cities */}
                    {topCities.length > 0 && (
                        <div className="bg-black/20 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                🏙️ Major Cities
                            </h3>
                            <div className="space-y-2">
                                {topCities.map((city, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-300">
                                            {city.isCapital && '⭐ '}{city.name}
                                        </span>
                                        <span className="text-gray-500">
                                            {(city.population / 1_000_000).toFixed(1)}M
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Affected Countries */}
                    <div className="bg-black/20 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                            🌍 Affected Countries
                        </h3>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {consequences.map((c, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-300">{c.countryName}</span>
                                    <div className="text-right">
                                        <span className="text-orange-400">{c.lostPercentage.toFixed(1)}%</span>
                                        <span className="text-gray-500 ml-2">
                                            {(c.populationCaptured / 1_000_000).toFixed(1)}M
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/10">
                    <button
                        onClick={onConfirm}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg transition-all"
                    >
                        Continue to Constitution →
                    </button>
                </div>
            </div>
        </div>
    )
}

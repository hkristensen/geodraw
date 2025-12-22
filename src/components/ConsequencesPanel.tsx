import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { Consequence } from '../types/store'
import { getConsequenceStats } from '../utils/calculateConsequences'
import { getCityCaptureStats } from '../utils/calculateCityCapture'

function formatNumber(num: number): string {
    if (num >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(1) + 'B'
    }
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(1) + 'M'
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(1) + 'K'
    }
    return num.toString()
}

function CountryCard({ consequence }: { consequence: Consequence }) {
    const percentColor =
        consequence.lostPercentage > 50 ? 'text-red-400' :
            consequence.lostPercentage > 20 ? 'text-orange-400' :
                'text-yellow-400'

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10 hover:border-orange-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h4 className="font-semibold text-white">{consequence.countryName}</h4>
                    <span className="text-xs text-gray-400">{consequence.countryCode}</span>
                </div>
                <span className={`text-lg font-bold ${percentColor}`}>
                    {consequence.lostPercentage.toFixed(1)}%
                </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div>
                    <span className="text-gray-500">Area: </span>
                    {formatNumber(consequence.lostArea)} km²
                </div>
                <div>
                    <span className="text-gray-500">Pop: </span>
                    ~{formatNumber(consequence.populationCaptured)}
                </div>
            </div>
        </div>
    )
}

export function ConsequencesPanel() {
    const {
        consequences,
        showResults,
        isCalculating,
        capturedCities,
        modifiers,
        phase,
        annexedCountries,
        infrastructureStats
    } = useGameStore()

    const [isMinimized, setIsMinimized] = useState(false)

    // Don't show during constitution phase (modal is visible)
    if (phase === 'CONSTITUTION') {
        return null
    }

    if (!showResults && !isCalculating) {
        return null
    }

    // Filter out annexed countries from the list
    const activeConsequences = consequences.filter(c => !annexedCountries.includes(c.countryCode))

    const stats = getConsequenceStats(activeConsequences)
    const cityStats = getCityCaptureStats(capturedCities)

    // Use infrastructureStats if available for accurate real-time data
    const displayStats = infrastructureStats ? {
        countriesAffected: activeConsequences.length,
        cityCount: infrastructureStats.cities.length,
        totalArea: infrastructureStats.totalAreaKm2,
        totalPopulation: infrastructureStats.totalPopulation
    } : {
        countriesAffected: stats.countriesAffected,
        cityCount: cityStats.cityCount,
        totalArea: stats.totalArea,
        totalPopulation: stats.totalPopulation
    }

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="absolute top-4 right-0 bg-slate-900/90 backdrop-blur-md p-3 rounded-l-xl border-y border-l border-orange-500/30 shadow-2xl z-10 hover:bg-slate-800 transition-colors"
            >
                <span className="text-xl">🗺️</span>
            </button>
        )
    }

    return (
        <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-5rem)] bg-slate-900/90 backdrop-blur-md rounded-xl border border-orange-500/30 shadow-2xl overflow-hidden z-10 transition-all duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 p-4 border-b border-orange-500/20">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>🗺️</span>
                        Territory
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            title="Minimize"
                        >
                            ➡️
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                {activeConsequences.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                        <div className="bg-black/30 rounded-lg p-2">
                            <div className="text-orange-400 font-bold">{displayStats.countriesAffected}</div>
                            <div className="text-xs text-gray-400">Countries</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-2">
                            <div className="text-orange-400 font-bold">{displayStats.cityCount}</div>
                            <div className="text-xs text-gray-400">Cities</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-2">
                            <div className="text-orange-400 font-bold">{formatNumber(displayStats.totalArea)}</div>
                            <div className="text-xs text-gray-400">km²</div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-2">
                            <div className="text-orange-400 font-bold">{formatNumber(displayStats.totalPopulation)}</div>
                            <div className="text-xs text-gray-400">People</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Modifiers */}
            {modifiers.length > 0 && (
                <div className="p-3 bg-red-900/30 border-b border-red-500/20">
                    <h3 className="text-xs font-semibold text-red-400 uppercase mb-2">⚠️ Active Modifiers</h3>
                    {modifiers.map((mod, i) => (
                        <div key={i} className="text-sm text-red-300 flex items-center gap-2">
                            <span className="text-red-400">🔥</span>
                            <span>{mod.description}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[50vh] custom-scrollbar">
                {isCalculating ? (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-gray-400">Calculating annexations...</p>
                    </div>
                ) : activeConsequences.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>No active claims</p>
                        <p className="text-sm mt-1">Draw a larger territory!</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {activeConsequences.map((consequence) => (
                            <CountryCard
                                key={consequence.countryCode}
                                consequence={consequence}
                            />
                        ))}
                    </div>
                )}

                {/* Captured Cities Section */}
                {capturedCities.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">🏙️ Major Cities Captured</h3>
                        <div className="space-y-1">
                            {capturedCities.slice(0, 5).map((city) => (
                                <div key={city.name} className="flex justify-between text-sm">
                                    <span className="text-white">
                                        {city.isCapital && <span className="mr-1">⭐</span>}
                                        {city.name}
                                    </span>
                                    <span className="text-gray-400">{formatNumber(city.population)}</span>
                                </div>
                            ))}
                            {capturedCities.length > 5 && (
                                <p className="text-xs text-gray-500">+{capturedCities.length - 5} more cities</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Power Classification */}
            {stats.totalPopulation >= 10_000_000 && (
                <div className="p-3 bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-t border-amber-500/30">
                    <p className="text-center text-amber-300 font-semibold">
                        👑 You are a Great Power!
                    </p>
                    <p className="text-center text-xs text-amber-400/70">
                        {formatNumber(stats.totalPopulation)}+ population under your control
                    </p>
                </div>
            )}
        </div>
    )
}

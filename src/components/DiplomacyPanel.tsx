import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import type { AICountry, DiplomaticAction } from '../types/game'

function getDispositionColor(disposition: AICountry['disposition']): string {
    switch (disposition) {
        case 'friendly': return 'text-green-400'
        case 'neutral': return 'text-yellow-400'
        case 'hostile': return 'text-orange-400'
        case 'at_war': return 'text-red-400'
    }
}

function getDispositionIcon(disposition: AICountry['disposition']): string {
    switch (disposition) {
        case 'friendly': return '😊'
        case 'neutral': return '😐'
        case 'hostile': return '😠'
        case 'at_war': return '⚔️'
    }
}

function CountryRow({
    country,
    onAction
}: {
    country: AICountry
    onAction: (action: DiplomaticAction, code: string) => void
}) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="border border-white/10 rounded-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span>{getDispositionIcon(country.disposition)}</span>
                    <span className="text-white font-medium">{country.name}</span>
                    {country.modifiers.includes('REVANCHISM') && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                            REVANCHISM
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-sm ${getDispositionColor(country.disposition)}`}>
                        {country.relations > 0 ? '+' : ''}{country.relations}
                    </span>
                    <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
                </div>
            </button>

            {/* Expanded Actions */}
            {expanded && (
                <div className="p-3 bg-black/30 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-3">
                        <div>⚔️ Soldiers: {country.soldiers?.toLocaleString() || '?'}</div>
                        <div>💰 Economy: {country.economy || '?'}/100</div>
                        <div>🏛️ Authority: {country.authority || '?'}/100</div>
                        <div>⛪ {country.religion || 'Unknown'}</div>
                        <div>📍 Territory Lost: {country.territoryLost.toFixed(1)}%</div>
                        <div>💪 Power: {country.power}</div>
                    </div>

                    {country.disposition === 'at_war' ? (
                        <button
                            onClick={() => onAction('OFFER_PEACE', country.code)}
                            className="w-full py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded text-green-400 text-sm transition-colors"
                        >
                            🕊️ Offer Peace
                        </button>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {country.disposition !== 'friendly' && (
                                <button
                                    onClick={() => onAction('IMPROVE_RELATIONS', country.code)}
                                    className="py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded text-blue-400 text-sm transition-colors"
                                >
                                    🤝 Improve
                                </button>
                            )}
                            {country.disposition === 'friendly' && !country.modifiers.includes('ALLIED') && (
                                <button
                                    onClick={() => onAction('PROPOSE_ALLIANCE', country.code)}
                                    className="py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded text-green-400 text-sm transition-colors"
                                >
                                    🤝 Alliance
                                </button>
                            )}
                            <button
                                onClick={() => onAction('DEMAND_TERRITORY', country.code)}
                                className="py-2 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-500/30 rounded text-yellow-400 text-sm transition-colors"
                            >
                                📜 Demand
                            </button>
                            {country.territoryLost > 0 && (
                                <button
                                    onClick={() => onAction('RETURN_TERRITORY', country.code)}
                                    className="py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-emerald-400 text-sm transition-colors"
                                >
                                    🎁 Return Land
                                </button>
                            )}
                            <button
                                onClick={() => onAction('DECLARE_WAR', country.code)}
                                className="py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded text-red-400 text-sm transition-colors col-span-2"
                            >
                                ⚔️ Declare War
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

interface DiplomacyPanelProps {
    onStartWar?: (code: string, name: string) => void
}

export function DiplomacyPanel({ onStartWar }: DiplomacyPanelProps) {
    const { phase, nation, addDiplomaticEvents, annexedCountries, removeTerritory, addTerritory, removeActiveClaim, setCurrentClaim, currentClaim } = useGameStore()
    const { aiCountries, updateRelations, declareWar, makePeace, formAlliance, returnTerritory } = useWorldStore()

    const [isMinimized, setIsMinimized] = useState(false)

    // Only show after nation is formed
    if (phase !== 'RESULTS' || !nation) {
        return null
    }

    const countries = Array.from(aiCountries.values())
        .filter(c => !annexedCountries.includes(c.code))
        .sort((a, b) => a.relations - b.relations) // Most hostile first

    if (countries.length === 0) {
        return null
    }

    const handleAction = (action: DiplomaticAction, countryCode: string) => {
        const country = aiCountries.get(countryCode)
        if (!country) return

        switch (action) {
            case 'IMPROVE_RELATIONS':
                updateRelations(countryCode, 15)
                addDiplomaticEvents([{
                    id: `diplomacy-${Date.now()}`,
                    type: 'BORDER_TENSION',
                    severity: 1,
                    title: `Relations with ${country.name} improved`,
                    description: `Diplomatic efforts have eased tensions with ${country.name}.`,
                    affectedNations: [countryCode],
                    timestamp: Date.now(),
                }])
                break

            case 'PROPOSE_ALLIANCE':
                formAlliance(countryCode)
                addDiplomaticEvents([{
                    id: `alliance-${Date.now()}`,
                    type: 'ALLIANCE_PROPOSED',
                    severity: 1,
                    title: `Alliance formed with ${country.name}!`,
                    description: `${nation.name} and ${country.name} have formed a defensive alliance.`,
                    affectedNations: [countryCode],
                    timestamp: Date.now(),
                }])
                break

            case 'DEMAND_TERRITORY':
                // Check if we have a claim
                // If we have a claim, and we are stronger, they might accept
                // Otherwise they refuse and relations worsen

                const hasClaim = currentClaim?.targetCountries.some(t => t.code === countryCode)
                // Use unified power for comparison
                const playerPower = nation.stats.power || 0
                const isStronger = playerPower > country.power * 1.5
                const isFriendly = country.relations > 50

                if (hasClaim && (isStronger || isFriendly)) {
                    // Success! They cede the territory
                    if (currentClaim) {
                        addTerritory(currentClaim.polygon)
                        removeActiveClaim(currentClaim.id)
                        setCurrentClaim(null)

                        addDiplomaticEvents([{
                            id: `demand-success-${Date.now()}`,
                            type: 'TERRITORY_DEMANDED',
                            severity: 2,
                            title: `${country.name} cedes territory!`,
                            description: `Bowing to pressure, ${country.name} has agreed to cede the claimed territory to ${nation.name}.`,
                            affectedNations: [countryCode],
                            timestamp: Date.now(),
                        }])
                        // Relation hit but not war
                        updateRelations(countryCode, -20)
                    }
                } else {
                    // Refusal
                    updateRelations(countryCode, -30)
                    addDiplomaticEvents([{
                        id: `demand-${Date.now()}`,
                        type: 'TERRITORY_DEMANDED',
                        severity: 2,
                        title: `${country.name} rejects territorial demands!`,
                        description: `${country.name} has refused ${nation.name}'s demands and recalled their ambassador.`,
                        affectedNations: [countryCode],
                        timestamp: Date.now(),
                    }])
                }
                break

            case 'DECLARE_WAR':
                declareWar(countryCode)
                addDiplomaticEvents([{
                    id: `war-${Date.now()}`,
                    type: 'WAR_DECLARED',
                    severity: 3,
                    title: `⚔️ WAR! ${nation.name} declares war on ${country.name}!`,
                    description: `Military forces are mobilizing as ${nation.name} has declared war on ${country.name}.`,
                    affectedNations: [countryCode],
                    timestamp: Date.now(),
                }])
                // Open war modal if provided
                if (onStartWar) {
                    onStartWar(countryCode, country.name)
                }
                break

            case 'OFFER_PEACE':
                makePeace(countryCode)
                addDiplomaticEvents([{
                    id: `peace-${Date.now()}`,
                    type: 'PEACE_OFFERED',
                    severity: 2,
                    title: `Peace with ${country.name}!`,
                    description: `The war with ${country.name} has ended. Tensions remain high.`,
                    affectedNations: [countryCode],
                    timestamp: Date.now(),
                }])
                break

            case 'RETURN_TERRITORY':
                // 1. Calculate geometry to return
                // We need to find the intersection of player territory and the original country shape
                import('../data/countries.json').then((data) => {
                    const countriesData = data as any
                    const originalFeature = countriesData.features.find((f: any) => f.properties?.iso_a3 === countryCode)
                    const playerPoly = useGameStore.getState().playerTerritories[0]

                    if (originalFeature && playerPoly) {
                        import('../utils/territoryUtils').then(() => {
                            // We want to give back the part of OUR territory that overlaps with THEIR original territory
                            // This is effectively an intersection
                            const importTurf = import('@turf/turf')
                            importTurf.then((turf) => {
                                const intersection = turf.intersect(turf.featureCollection([playerPoly as any, originalFeature as any]))

                                if (intersection) {
                                    // Remove from player
                                    removeTerritory(intersection as any)

                                    // Update AI state
                                    returnTerritory(countryCode)

                                    addDiplomaticEvents([{
                                        id: `return-${Date.now()}`,
                                        type: 'PEACE_TREATY',
                                        severity: 1,
                                        title: `Territory Returned to ${country.name}`,
                                        description: `${nation.name} has returned occupied lands to ${country.name}. Relations have improved significantly.`,
                                        affectedNations: [countryCode],
                                        timestamp: Date.now(),
                                    }])
                                }
                            })
                        })
                    }
                })
                break
        }
    }

    const atWarCount = countries.filter(c => c.isAtWar).length
    const hostileCount = countries.filter(c => c.disposition === 'hostile').length

    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="absolute top-4 left-80 ml-4 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-b-xl border-x border-b border-purple-500/30 shadow-2xl z-10 hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
                <span className="text-xl">🌐</span>
                {atWarCount > 0 && <span className="text-red-400 text-xs font-bold">{atWarCount}</span>}
            </button>
        )
    }

    return (
        <div className="absolute top-4 left-80 ml-4 w-72 max-h-[calc(100vh-5rem)] bg-slate-900/90 backdrop-blur-md rounded-xl border border-orange-500/30 shadow-2xl overflow-hidden z-10 transition-all duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4 border-b border-purple-500/20 flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>🌐</span>
                        Diplomacy
                    </h2>
                    <div className="flex gap-3 mt-2 text-xs">
                        {atWarCount > 0 && (
                            <span className="text-red-400">⚔️ {atWarCount} at war</span>
                        )}
                        {hostileCount > 0 && (
                            <span className="text-orange-400">😠 {hostileCount} hostile</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => setIsMinimized(true)}
                    className="text-gray-400 hover:text-white transition-colors p-1"
                    title="Minimize"
                >
                    ⬆️
                </button>
            </div>

            {/* Country List */}
            <div className="p-3 overflow-y-auto max-h-[60vh] custom-scrollbar space-y-2">
                {countries.map(country => (
                    <CountryRow
                        key={country.code}
                        country={country}
                        onAction={handleAction}
                    />
                ))}
            </div>
        </div>
    )
}

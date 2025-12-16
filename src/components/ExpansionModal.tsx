import { useState, useMemo } from 'react'
import { useGameStore } from '../store/gameStore'
import { useWorldStore } from '../store/worldStore'
import { quickWar } from '../utils/warSystem'

export function ExpansionModal() {
    const {
        phase,
        currentClaim,
        nation,
        setCurrentClaim,
        setPhase,
        addTerritory,
        addConsequences,
        addDiplomaticEvents,
        updateNationSoldiers,
    } = useGameStore()

    const { aiCountries, declareWar, updateRelations, makePeace } = useWorldStore()

    const [resolving, setResolving] = useState(false)
    const [result, setResult] = useState<{
        success: boolean
        message: string
        territoryPercent: number
    } | null>(null)

    // Get info about target countries - MUST be before any early returns
    const targetInfo = useMemo(() => {
        if (!currentClaim) return []
        return currentClaim.targetCountries.map(tc => {
            const aiCountry = aiCountries.get(tc.code)
            const soldiers = aiCountry
                ? Math.max(100, Math.round(aiCountry.population * (100 - aiCountry.territoryLost) / 100 * 0.02))
                : 1000
            return {
                ...tc,
                relations: aiCountry?.relations ?? 0,
                soldiers,
                disposition: aiCountry?.disposition ?? 'neutral',
            }
        })
    }, [currentClaim, aiCountries])

    const playerSoldiers = nation?.stats?.soldiers ?? 1000
    const totalEnemySoldiers = targetInfo.reduce((sum, t) => sum + t.soldiers, 0)
    const averageRelations = targetInfo.length > 0
        ? targetInfo.reduce((sum, t) => sum + t.relations, 0) / targetInfo.length
        : 0

    // Only show when we have a pending claim
    if (phase !== 'EXPANSION' || !currentClaim || currentClaim.status !== 'pending') {
        return null
    }

    const handleNegotiate = () => {
        if (!nation) return
        setResolving(true)

        // Negotiation success based on relations
        // Good relations (50+) = can get up to 50% of claim
        // Neutral (0-50) = can get up to 25%
        // Bad (<0) = fails

        let territoryPercent = 0
        let success = false
        let message = ''

        if (averageRelations >= 50) {
            success = true
            territoryPercent = 40 + Math.random() * 20 // 40-60%
            message = `Diplomacy successful! Acquired ${territoryPercent.toFixed(0)}% of claimed territory.`
        } else if (averageRelations >= 20) {
            success = true
            territoryPercent = 15 + Math.random() * 15 // 15-30%
            message = `Partial agreement reached. Acquired ${territoryPercent.toFixed(0)}% of claimed territory.`
        } else if (averageRelations >= 0) {
            success = Math.random() > 0.5
            if (success) {
                territoryPercent = 5 + Math.random() * 10 // 5-15%
                message = `Minor concessions granted. Acquired ${territoryPercent.toFixed(0)}%.`
            } else {
                message = 'Negotiations failed. No territory acquired.'
            }
        } else {
            message = 'Negotiations rejected! Relations too hostile.'
        }

        // Apply results after delay
        setTimeout(() => {
            if (success && territoryPercent > 0) {
                applyTerritoryGain(territoryPercent / 100)
            }

            // Worsens relations slightly from demanding territory
            for (const target of currentClaim.targetCountries) {
                updateRelations(target.code, -10)
            }

            addDiplomaticEvents([{
                id: `negotiate-${Date.now()}`,
                type: success ? 'ALLIANCE_PROPOSED' : 'BORDER_TENSION',
                severity: success ? 1 : 2,
                title: success ? '🤝 Diplomatic Success' : '❌ Negotiations Failed',
                description: message,
                affectedNations: currentClaim.targetCountries.map(t => t.code),
                timestamp: Date.now(),
            }])

            setResult({ success, message, territoryPercent })
            setResolving(false)
        }, 500)
    }

    const handleDemand = () => {
        if (!nation) return
        setResolving(true)

        // Demand success based on power comparison
        // Need 2x soldiers to reliably succeed
        const powerRatio = playerSoldiers / (totalEnemySoldiers || 1)

        let territoryPercent = 0
        let success = false
        let message = ''

        if (powerRatio >= 3) {
            success = true
            territoryPercent = 80 + Math.random() * 20 // 80-100%
            message = `Your overwhelming power forced total capitulation! Claimed ${territoryPercent.toFixed(0)}%.`
        } else if (powerRatio >= 2) {
            success = true
            territoryPercent = 50 + Math.random() * 30 // 50-80%
            message = `They bowed to your superior force. Claimed ${territoryPercent.toFixed(0)}%.`
        } else if (powerRatio >= 1.2) {
            success = Math.random() > 0.3
            if (success) {
                territoryPercent = 20 + Math.random() * 30 // 20-50%
                message = `After tense standoff, achieved partial concessions. Claimed ${territoryPercent.toFixed(0)}%.`
            } else {
                message = 'Your bluff was called! Demand rejected.'
            }
        } else {
            message = `They laughed at your demands! (Need ${Math.ceil(totalEnemySoldiers * 1.2).toLocaleString()} soldiers)`
        }

        setTimeout(() => {
            if (success && territoryPercent > 0) {
                applyTerritoryGain(territoryPercent / 100)
            }

            // Significantly worsens relations
            for (const target of currentClaim.targetCountries) {
                updateRelations(target.code, success ? -30 : -50)
            }

            addDiplomaticEvents([{
                id: `demand-${Date.now()}`,
                type: success ? 'TERRITORY_DEMANDED' : 'BORDER_TENSION',
                severity: 2,
                title: success ? '💪 Demand Accepted' : '❌ Demand Rejected',
                description: message,
                affectedNations: currentClaim.targetCountries.map(t => t.code),
                timestamp: Date.now(),
            }])

            setResult({ success, message, territoryPercent })
            setResolving(false)
        }, 500)
    }

    const handleWar = () => {
        if (!nation) return
        setResolving(true)

        // Run quick war simulation
        const warResult = quickWar(playerSoldiers, totalEnemySoldiers)

        let territoryPercent = 0
        let success = warResult.winner === 'attacker'
        let message = ''

        if (success) {
            // Territory gained based on decisiveness
            territoryPercent = warResult.decisiveness * 100
            message = `Victory! Conquered ${territoryPercent.toFixed(0)}% of claimed territory. Lost ${(playerSoldiers - warResult.attackerRemaining).toLocaleString()} soldiers.`
        } else {
            message = `Defeat! Lost ${(playerSoldiers - warResult.attackerRemaining).toLocaleString()} soldiers.`
        }

        setTimeout(() => {
            // Update soldiers
            updateNationSoldiers(warResult.attackerRemaining)

            if (success && territoryPercent > 0) {
                applyTerritoryGain(territoryPercent / 100)
            }

            // War dramatically affects relations
            for (const target of currentClaim.targetCountries) {
                declareWar(target.code)
                makePeace(target.code)
                updateRelations(target.code, success ? -80 : -40)
            }

            addDiplomaticEvents([{
                id: `war-${Date.now()}`,
                type: 'WAR_DECLARED',
                severity: 3,
                title: success ? '🏆 War Won!' : '💀 War Lost!',
                description: message,
                affectedNations: currentClaim.targetCountries.map(t => t.code),
                timestamp: Date.now(),
            }])

            setResult({ success, message, territoryPercent })
            setResolving(false)
        }, 800)
    }

    const applyTerritoryGain = (percent: number) => {
        // Add territory to player (scaled by percent gained)
        console.log('📍 Adding territory:', currentClaim.polygon, 'percent:', percent)
        addTerritory(currentClaim.polygon)

        // Add consequences scaled by percent
        const newConsequences = currentClaim.targetCountries.map(tc => ({
            countryName: tc.name,
            countryCode: tc.code,
            lostPercentage: tc.percentageClaimed * percent,
            lostArea: tc.areaClaimedKm2 * percent,
            population: 0,
            populationCaptured: Math.round(tc.areaClaimedKm2 * 50 * percent), // Estimate
        }))
        addConsequences(newConsequences)

        // Update world state and check for annexation
        currentClaim.targetCountries.forEach(tc => {
            const aiCountry = aiCountries.get(tc.code)
            if (!aiCountry) return

            // Calculate new total territory lost
            // We need to be careful not to double count if we run this multiple times
            // But here we are just adding the *new* loss
            const additionalLoss = tc.percentageClaimed * percent
            const newTotalLoss = aiCountry.territoryLost + additionalLoss

            // Update occupation in world store
            useWorldStore.getState().updateOccupation(tc.code, additionalLoss)

            // Check for annexation (if > 95% lost, consider it gone)
            if (newTotalLoss >= 95) {
                console.log('🏴 Fully annexing country:', tc.name)

                // 1. Annex in Game Store (hides from map)
                useGameStore.getState().annexCountry(tc.code)

                // 2. Annex in World Store (stops AI logic)
                useWorldStore.getState().annexCountry(tc.code)

                // 3. Add Event
                addDiplomaticEvents([{
                    id: `annex-${Date.now()}-${tc.code}`,
                    type: 'ANNEXATION',
                    severity: 3,
                    title: 'Country Annexed',
                    description: `${tc.name} has been fully annexed into our nation!`,
                    affectedNations: [tc.code],
                    timestamp: Date.now()
                }])
            }
        })
    }

    const handleClose = () => {
        setCurrentClaim(null)
        setPhase('RESULTS')
        setResult(null)
    }

    const handleCancel = () => {
        setCurrentClaim(null)
        setPhase('RESULTS')
    }

    // If we have a result, show it
    if (result) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-slate-900 border border-orange-500/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                    <div className={`p-6 ${result.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                        <div className="text-center">
                            <div className="text-4xl mb-2">{result.success ? '🎉' : '😔'}</div>
                            <h2 className={`text-xl font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                {result.success ? 'Success!' : 'Failed'}
                            </h2>
                            <p className="text-gray-300 mt-2">{result.message}</p>
                            {result.success && result.territoryPercent > 0 && (
                                <div className="mt-3 text-sm text-gray-400">
                                    +{result.territoryPercent.toFixed(0)}% of claimed territory added
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="p-4">
                        <button
                            onClick={handleClose}
                            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-orange-500/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 p-6 border-b border-orange-500/20">
                    <h2 className="text-2xl font-bold text-white text-center">
                        🏴 Territorial Claim
                    </h2>
                    <p className="text-gray-400 text-center mt-1 text-sm">
                        How will you acquire this territory?
                    </p>
                </div>

                {/* Target Countries */}
                <div className="p-4 bg-black/30 border-b border-white/5">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Affected Nations</h3>
                    <div className="space-y-2">
                        {targetInfo.map(target => (
                            <div key={target.code} className="flex justify-between items-center text-sm">
                                <div>
                                    <span className="text-white">{target.name}</span>
                                    <span className={`ml-2 text-xs ${target.disposition === 'hostile' ? 'text-red-400' :
                                        target.disposition === 'friendly' ? 'text-green-400' :
                                            'text-gray-400'
                                        }`}>
                                        ({target.relations > 0 ? '+' : ''}{target.relations})
                                    </span>
                                </div>
                                <span className="text-orange-400">{target.percentageClaimed.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs text-gray-400">
                        <span>Your Soldiers: {playerSoldiers.toLocaleString()}</span>
                        <span>Enemy Soldiers: {totalEnemySoldiers.toLocaleString()}</span>
                    </div>
                </div>

                {/* Resolution Options */}
                <div className="p-4 space-y-3">
                    <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded text-sm text-gray-300 mb-4">
                        <p>
                            <strong>ℹ️ Passive Claim:</strong> This will mark the territory as claimed on the map.
                            You can then use Diplomacy to demand it or launch an offensive to seize it.
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            // Apply claims to all target countries
                            currentClaim.targetCountries.forEach(target => {
                                useWorldStore.getState().addClaim(target.code, target.percentageClaimed)
                            })

                            // Add to active claims list for map visualization
                            console.log('📝 Confirming claim:', currentClaim)
                            useGameStore.getState().addActiveClaim({
                                ...currentClaim,
                                status: 'claimed'
                            })

                            // Add diplomatic event
                            addDiplomaticEvents([{
                                id: `claim-${Date.now()}`,
                                type: 'BORDER_TENSION',
                                severity: 1,
                                title: 'Territory Claimed',
                                description: `We have officially claimed territory in ${currentClaim.targetCountries.map(c => c.name).join(', ')}.`,
                                affectedNations: currentClaim.targetCountries.map(t => t.code),
                                timestamp: Date.now(),
                            }])

                            handleClose()
                        }}
                        className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold rounded-lg shadow-lg transition-all"
                    >
                        ✅ Confirm Claim
                    </button>

                    <button
                        onClick={handleCancel}
                        className="w-full py-2 text-gray-400 hover:text-white text-sm transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
